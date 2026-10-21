import { AppError } from "../../../shared/errors/AppError";
import { IEmailSender } from "../../../shared/services/EmailSender";
import { IAdminRepository } from "../../admin/interface/IAdminRepository";
import { IAdvertiserRepository } from "../../advertiser/interfaces/IAdvertiserRepository";
import {
  AdvertiserType,
  VerificationStatus,
} from "../../advertiser/types/AdvertiserEnums";
import { IVacancyRepository } from "../../vacancy/interfaces/IVacancyRepository";
import { Vacancy } from "../../vacancy/schema/Vacancy.schema";
import {
  INDIVIDUAL_OPEN_VACANCY_LIMIT,
  VACANCY_VALIDITY_DAYS,
  VacancySituation,
} from "../../vacancy/types/VacancyEnums";
import {
  IPaymentRepository,
  ListPaymentsOptions,
} from "../interfaces/IPaymentRepository";
import { Payment } from "../schema/Payment.schema";
import { PaymentSituation } from "../types/PaymentEnums";
import { PaymentQueueItem, PaymentResult } from "../types/PaymentTypes";

function toResult(payment: Payment): PaymentResult {
  return {
    id: payment.id,
    vacancyId: payment.vacancyId,
    value: payment.value,
    referenceCode: payment.referenceCode,
    situation: payment.situation,
    decidedBy: payment.decidedBy,
    decidedAt: payment.decidedAt,
    note: payment.note,
  };
}

function toQueueItem(vacancy: Vacancy): PaymentQueueItem {
  return {
    vacancyId: vacancy.id,
    title: vacancy.title,
    type: vacancy.type,
    value: vacancy.value ?? 0,
    referenceCode: vacancy.referenceCode,
    advertiserId: vacancy.advertiserId,
    advertiserName: vacancy.advertiser.displayName,
    advertiserDocument: vacancy.advertiser.document,
    advertiserVerification: vacancy.advertiser.verification,
    awaitingSince: vacancy.updatedAt,
  };
}

// RN-VG2 / RN-P4: 60 dias a partir da publicação, sem renovação. A data é
// calculada na CONFIRMAÇÃO, não no envio: a validade conta do momento em
// que a vaga fica visível, e entre o envio e o PIX podem passar dias.
function expiryFrom(publishedAt: Date): Date {
  const expiry = new Date(publishedAt);
  expiry.setUTCDate(expiry.getUTCDate() + VACANCY_VALIDITY_DAYS);

  return expiry;
}

export class PaymentService {
  constructor(
    private payments: IPaymentRepository,
    private vacancies: IVacancyRepository,
    private advertisers: IAdvertiserRepository,
    private admins: IAdminRepository,
    private mailer: IEmailSender,
  ) {}

  // RF37: a fila. São as VAGAS em `aguardando_pagamento` — não há linha de
  // pagamento antes da decisão do admin (RN-P7), então a vaga é a fila.
  async listQueueService(options: { page: number; limit: number }) {
    const { items, total } = await this.vacancies.listAwaitingPayment(options);

    return {
      items: items.map(toQueueItem),
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  // RF37 + RNF07: confirmar publica a vaga e registra quem confirmou.
  async confirmService(
    adminId: string,
    vacancyId: string,
    note: string | null,
  ): Promise<PaymentResult> {
    const vacancy = await this.awaitingPaymentOrFail(vacancyId);

    // Reconferência: entre o envio e o PIX podem passar dias, e o que
    // valia no envio pode não valer mais. A task 13 deixou esta checagem
    // anotada justamente para cá.
    await this.assertStillPublishable(vacancy);

    const now = new Date();

    // O pagamento é gravado ANTES da publicação: se o INSERT falhar pelo
    // UK (dois admins confirmando a mesma vaga ao mesmo tempo), a vaga não
    // pode ter sido publicada — senão a segunda tentativa abriria uma vaga
    // já aberta e o dinheiro ficaria sem registro.
    const payment = await this.payments.record({
      vacancyId: vacancy.id,
      // RN-P8: o valor é o da LINHA DA VAGA, copiado no envio. A tabela de
      // preços não é relida aqui — se o admin mudou o preço depois do
      // envio, o anunciante pagou o valor antigo, e é esse que vale.
      value: vacancy.value ?? 0,
      referenceCode: vacancy.referenceCode,
      situation: PaymentSituation.CONFIRMED,
      decidedBy: adminId,
      note,
    });

    if (!payment) {
      throw new AppError("Esta vaga já tem um pagamento registrado", 409);
    }

    await this.vacancies.transition(vacancy.id, {
      situation: VacancySituation.OPEN,
      publishedAt: now,
      expiresAt: expiryFrom(now),
    });

    await this.notifyAdvertiserPublished(vacancy);

    return toResult(payment);
  }

  // RF37 + RN-P6: recusar encerra a vaga. É terminal — o anunciante publica
  // outra, como manda a RN-P5 para qualquer erro achado depois do envio.
  // Isso é o que o `vaga_id` UK do SRS 6 permite: um pagamento por vaga.
  //
  // `moneyReceived` separa as duas recusas: sem dinheiro na conta é
  // RECUSADO (não há o que devolver); com dinheiro é REEMBOLSADO, que é o
  // reembolso da RN-P6 — só existe antes da publicação.
  async rejectService(
    adminId: string,
    vacancyId: string,
    reason: string,
    moneyReceived: boolean,
  ): Promise<PaymentResult> {
    const vacancy = await this.awaitingPaymentOrFail(vacancyId);

    const payment = await this.payments.record({
      vacancyId: vacancy.id,
      value: vacancy.value ?? 0,
      referenceCode: vacancy.referenceCode,
      situation: moneyReceived
        ? PaymentSituation.REFUNDED
        : PaymentSituation.REFUSED,
      decidedBy: adminId,
      note: reason,
    });

    if (!payment) {
      throw new AppError("Esta vaga já tem um pagamento registrado", 409);
    }

    await this.vacancies.transition(vacancy.id, {
      situation: VacancySituation.CLOSED,
      closedAt: new Date(),
    });

    await this.notifyAdvertiserRejected(vacancy, reason, moneyReceived);

    return toResult(payment);
  }

  // RF37: "ver pagamentos por período".
  async listService(options: ListPaymentsOptions) {
    const { items, total, confirmedTotal } = await this.payments.list(options);

    return {
      items: items.map(toResult),
      total,
      // Soma das linhas CONFIRMADAS do período inteiro, não da página.
      confirmedTotal,
      page: options.page,
      limit: options.limit,
    };
  }

  // RF28: avisa os administradores de que há vaga esperando confirmação.
  // Chamado pelo envio da vaga (task 13), não por uma rota.
  async notifyAdminsOfPendingPaymentService(vacancy: {
    title: string;
    value: number;
    referenceCode: string;
    advertiserName: string;
  }): Promise<void> {
    const emails = await this.admins.listActiveEmails();

    // Um e-mail por admin, e não um com todos em cópia: o endereço de um
    // administrador não é assunto dos outros.
    for (const to of emails) {
      await this.mailer.send({
        to,
        subject: `Vaga aguardando pagamento: ${vacancy.referenceCode}`,
        body:
          `${vacancy.advertiserName} enviou a vaga "${vacancy.title}" para ` +
          `publicação.\n\n` +
          `Valor: R$ ${vacancy.value.toFixed(2)}\n` +
          `Código de referência: ${vacancy.referenceCode}\n\n` +
          `Confira o PIX pelo código de referência e confirme ou recuse na ` +
          `fila de pagamentos.`,
      });
    }
  }

  private async awaitingPaymentOrFail(vacancyId: string): Promise<Vacancy> {
    const vacancy = await this.vacancies.findById(vacancyId);

    if (!vacancy) {
      throw new AppError("Vaga não encontrada", 404);
    }

    if (vacancy.situation !== VacancySituation.AWAITING_PAYMENT) {
      throw new AppError("Esta vaga não está aguardando pagamento", 409);
    }

    return vacancy;
  }

  // O que pode ter mudado entre o envio e a confirmação do PIX.
  private async assertStillPublishable(vacancy: Vacancy): Promise<void> {
    const advertiser = await this.advertisers.findById(vacancy.advertiserId);

    if (!advertiser || !advertiser.active) {
      throw new AppError(
        "Anunciante inativo: a vaga não pode ser publicada",
        409,
      );
    }

    // RN-P2 / RN-V4: a vaga paga exige verificação. Se o anunciante mudou o
    // nome depois do envio, a RF23 o devolveu para pendente — e publicar
    // agora daria a uma vaga paga o selo que ele não tem mais.
    if (advertiser.verification !== VerificationStatus.VERIFIED) {
      throw new AppError(
        "Anunciante não está verificado: a vaga paga não pode ser publicada",
        409,
      );
    }

    // RN-V3a: o limite da pessoa física é conferido no envio E aqui. Entre
    // os dois momentos outra vaga pode ter aberto, e a confirmação é o
    // último ponto em que dá para impedir a quarta.
    if (advertiser.type === AdvertiserType.INDIVIDUAL) {
      const open = await this.vacancies.countOpen(advertiser.id);

      if (open >= INDIVIDUAL_OPEN_VACANCY_LIMIT) {
        throw new AppError(
          `Anunciante pessoa física tem no máximo ${INDIVIDUAL_OPEN_VACANCY_LIMIT} vagas abertas ao mesmo tempo`,
          409,
        );
      }
    }
  }

  // SRS 7: "quando o admin confirma, ela abre e sou avisado por e-mail".
  private async notifyAdvertiserPublished(vacancy: Vacancy): Promise<void> {
    for (const to of await this.responsibleEmailsOf(vacancy.advertiserId)) {
      await this.mailer.send({
        to,
        subject: `Vaga publicada: ${vacancy.title}`,
        body:
          `O pagamento da vaga "${vacancy.title}" foi confirmado e ela já ` +
          `está no ar.\n\n` +
          `A vaga fica aberta por ${VACANCY_VALIDITY_DAYS} dias e então é ` +
          `encerrada automaticamente. Não há renovação: para continuar ` +
          `contratando depois disso, publique uma nova vaga.`,
      });
    }
  }

  private async notifyAdvertiserRejected(
    vacancy: Vacancy,
    reason: string,
    moneyReceived: boolean,
  ): Promise<void> {
    // RN-P6: o reembolso é feito à mão, por PIX de volta. O e-mail diz o
    // que esperar para o anunciante não abrir um pedido de suporte.
    const money = moneyReceived
      ? "O valor pago será devolvido por PIX."
      : "Nenhum pagamento foi identificado, então não há valor a devolver.";

    for (const to of await this.responsibleEmailsOf(vacancy.advertiserId)) {
      await this.mailer.send({
        to,
        subject: `Vaga recusada: ${vacancy.title}`,
        body:
          `A vaga "${vacancy.title}" (código ${vacancy.referenceCode}) foi ` +
          `recusada e encerrada.\n\n` +
          `Motivo: ${reason}\n\n` +
          `${money}\n\n` +
          `Para anunciar novamente, publique uma nova vaga.`,
      });
    }
  }

  private async responsibleEmailsOf(advertiserId: string): Promise<string[]> {
    const responsibles = await this.advertisers.listResponsibles(advertiserId);

    return responsibles.filter((r) => r.active).map((r) => r.email);
  }
}
