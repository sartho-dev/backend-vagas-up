import { AppError } from "../../../shared/errors/AppError";
import { IAdvertiserRepository } from "../../advertiser/interfaces/IAdvertiserRepository";
import { IResponsibleRepository } from "../../advertiser/interfaces/IResponsibleRepository";
import {
  AdvertiserType,
  VerificationStatus,
} from "../../advertiser/types/AdvertiserEnums";
import { SettingService } from "../../pricing/service/SettingService";
import { SettingKey } from "../../pricing/types/PricingEnums";
import { VacancyPriceService } from "../../pricing/service/VacancyPriceService";
import { IPendingPaymentNotifier } from "../interfaces/IPendingPaymentNotifier";
import { IVacancyRepository } from "../interfaces/IVacancyRepository";
import { Vacancy } from "../schema/Vacancy.schema";
import {
  EDITABLE_SITUATIONS,
  INDIVIDUAL_OPEN_VACANCY_LIMIT,
  VACANCY_VALIDITY_DAYS,
  VacancySituation,
  WORK_HOURS_UNIT,
} from "../types/VacancyEnums";
import { VacancyPaymentInfo, VacancyResult } from "../types/VacancyTypes";
import {
  CreateVacancyInput,
  PatchVacancyInput,
  assertDeadlineWithinValidity,
  assertWorkHoursWithinLimit,
} from "../validators/VacancyValidator";
import { generateReferenceCode } from "./ReferenceCode";

function toResult(vacancy: Vacancy): VacancyResult {
  return {
    id: vacancy.id,
    advertiserId: vacancy.advertiserId,
    createdBy: vacancy.createdBy,
    type: vacancy.type,
    title: vacancy.title,
    description: vacancy.description,
    modality: vacancy.modality,
    city: vacancy.city,
    workHours: vacancy.workHours,
    // RN-VG4: o número sozinho é ambíguo, então a unidade vai com ele.
    workHoursUnit: WORK_HOURS_UNIT[vacancy.type],
    minEducation: vacancy.minEducation,
    requiresAdult: vacancy.requiresAdult,
    positions: vacancy.positions,
    courseId: vacancy.courseId,
    requirements: vacancy.requirements,
    benefits: vacancy.benefits,
    compensation: vacancy.compensation,
    schedule: vacancy.schedule,
    deadline: vacancy.deadline,
    situation: vacancy.situation,
    free: vacancy.free,
    value: vacancy.value,
    referenceCode: vacancy.referenceCode,
    publishedAt: vacancy.publishedAt,
    expiresAt: vacancy.expiresAt,
    closedAt: vacancy.closedAt,
    createdAt: vacancy.createdAt,
  };
}

// Violação de unicidade no Postgres. Só o `reference_code` é UNIQUE nesta
// tabela, então um 23505 aqui é colisão de código sorteado.
const UNIQUE_VIOLATION = "23505";
const REFERENCE_CODE_ATTEMPTS = 5;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}

export class VacancyService {
  constructor(
    private repository: IVacancyRepository,
    private advertisers: IAdvertiserRepository,
    private responsibles: IResponsibleRepository,
    private prices: VacancyPriceService,
    private settings: SettingService,
    private paymentNotifier: IPendingPaymentNotifier,
  ) {}

  // A sessão identifica o RESPONSÁVEL; a vaga pertence ao anunciante dele.
  // Mesma resolução do AdvertiserService — nenhuma rota recebe o id do
  // anunciante pelo cliente, senão um responsável publicaria vaga no nome
  // de outra empresa.
  private async advertiserOf(responsibleId: string): Promise<string> {
    const responsible = await this.responsibles.findById(responsibleId);

    if (!responsible) {
      throw new AppError("Responsável não encontrado", 404);
    }

    return responsible.advertiserId;
  }

  // 404 e não 403 para vaga de outro anunciante: a posse é filtro de banco,
  // então nesse escopo a vaga alheia não existe. Um 403 confirmaria que
  // aquele id existe em algum lugar — mesma escolha da task 09.
  private async ownedOrFail(
    id: string,
    advertiserId: string,
  ): Promise<Vacancy> {
    const vacancy = await this.repository.findOwned(id, advertiserId);

    if (!vacancy) {
      throw new AppError("Vaga não encontrada", 404);
    }

    return vacancy;
  }

  // RF24: nasce rascunho, sem valor e sem data de publicação. Nada aqui
  // depende de verificação nem de pagamento — o anunciante monta a vaga
  // antes de decidir publicá-la.
  async createService(
    responsibleId: string,
    data: CreateVacancyInput,
  ): Promise<VacancyResult> {
    const advertiserId = await this.advertiserOf(responsibleId);

    assertWorkHoursWithinLimit(data.type, data.workHours);

    // O código nasce com a vaga porque é também o número pelo qual o
    // anunciante se refere a ela, não só a descrição do PIX (RN-P3). A
    // colisão é improvável (31^8), mas a coluna é UNIQUE: tentar de novo
    // custa menos que devolver 500 por um sorteio azarado.
    for (let attempt = 1; attempt <= REFERENCE_CODE_ATTEMPTS; attempt += 1) {
      try {
        const vacancy = await this.repository.create({
          ...data,
          advertiserId,
          createdBy: responsibleId,
          referenceCode: generateReferenceCode(),
        });

        return toResult(vacancy);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }

    throw new AppError(
      "Não foi possível gerar o código de referência da vaga. Tente novamente",
      503,
    );
  }

  async listOwnService(responsibleId: string): Promise<VacancyResult[]> {
    const advertiserId = await this.advertiserOf(responsibleId);
    const vacancies = await this.repository.listByAdvertiser(advertiserId);

    return vacancies.map(toResult);
  }

  // RF29: é esta leitura que alimenta a tela de revisão. Devolve a vaga
  // inteira, como o candidato a verá.
  async getOwnService(
    responsibleId: string,
    id: string,
  ): Promise<VacancyResult> {
    const advertiserId = await this.advertiserOf(responsibleId);

    return toResult(await this.ownedOrFail(id, advertiserId));
  }

  // RN-P5 / RN-VG5: antes da publicação tudo é editável; depois, nada.
  // O 409 (e não 403) é deliberado: a rota é permitida para este
  // responsável, mas o ESTADO da vaga não aceita a operação.
  async updateOwnService(
    responsibleId: string,
    id: string,
    patch: PatchVacancyInput,
  ): Promise<VacancyResult> {
    const advertiserId = await this.advertiserOf(responsibleId);
    const vacancy = await this.ownedOrFail(id, advertiserId);

    if (!EDITABLE_SITUATIONS.includes(vacancy.situation)) {
      throw new AppError(
        "Vaga publicada não pode ser editada. Encerre-a e publique outra",
        409,
      );
    }

    // RN-VG4 sobre o estado RESULTANTE: trocar só o tipo de emprego para
    // estágio deixaria 44 h num estágio se a checagem olhasse apenas o que
    // veio no corpo.
    const type = patch.type ?? vacancy.type;
    const workHours = patch.workHours ?? vacancy.workHours;
    assertWorkHoursWithinLimit(type, workHours);

    const updated = await this.repository.update(id, patch);

    if (!updated) {
      throw new AppError("Vaga não encontrada", 404);
    }

    return toResult(updated);
  }

  // RF29 + RN-P1 + RN-P2 + RN-P8: o envio é o ponto em que a vaga deixa de
  // ser rascunho. É aqui que se decide gratuita ou paga, que o preço é
  // COPIADO da tabela, e que a gratuita já abre.
  async submitOwnService(
    responsibleId: string,
    id: string,
  ): Promise<VacancyResult> {
    const advertiserId = await this.advertiserOf(responsibleId);
    const vacancy = await this.ownedOrFail(id, advertiserId);

    if (vacancy.situation !== VacancySituation.DRAFT) {
      throw new AppError(
        "Só um rascunho pode ser enviado para publicação",
        409,
      );
    }

    const advertiser = await this.advertisers.findById(advertiserId);

    if (!advertiser || !advertiser.active) {
      throw new AppError("Anunciante inativo não publica vaga", 403);
    }

    const now = new Date();

    // Revalidadas no envio, não só no cadastro: o rascunho pode ter ficado
    // semanas parado, e um prazo que era válido na criação já passou.
    assertWorkHoursWithinLimit(vacancy.type, vacancy.workHours);
    assertDeadlineWithinValidity(vacancy.deadline, now);

    const free = !(await this.repository.hasUsedFreeVacancy(advertiserId));

    // RN-P2 / RN-V4: só o verificado publica vaga PAGA. A barreira é aqui,
    // antes do PIX, para ninguém pagar e ser recusado depois.
    if (!free && advertiser.verification !== VerificationStatus.VERIFIED) {
      throw new AppError(
        "Anunciante não verificado só publica a vaga gratuita. Peça a verificação para publicar as demais",
        403,
      );
    }

    // RN-V3a: o limite vale para a PF mesmo verificada e pagando. Conferido
    // de novo na confirmação do pagamento (task 14) — entre o envio e o PIX
    // outra vaga pode abrir.
    if (advertiser.type === AdvertiserType.INDIVIDUAL) {
      const open = await this.repository.countOpen(advertiserId);

      if (open >= INDIVIDUAL_OPEN_VACANCY_LIMIT) {
        throw new AppError(
          `Anunciante pessoa física tem no máximo ${INDIVIDUAL_OPEN_VACANCY_LIMIT} vagas abertas ao mesmo tempo`,
          409,
        );
      }
    }

    // RN-P8: a CÓPIA. Depois disso ninguém relê a tabela de preços para
    // esta vaga — alteração de preço não alcança o que já foi enviado.
    const value = free ? 0 : await this.prices.priceOfService(vacancy.type);

    // RN-P3: a paga espera o PIX; a gratuita não tem o que esperar e abre
    // na hora. Quem publica a paga é a task 14, ao confirmar o pagamento.
    let updated: Vacancy | null;

    if (free) {
      // A gratuita não tem PIX a esperar, então abre aqui. `publish` gera o
      // endereço público (RF42) — o mesmo método que a confirmação do PIX
      // usa, para os dois caminhos publicarem igual.
      updated = await this.repository.publish(id, now, expiryFrom(now), {
        free: true,
        value,
      });
    } else {
      updated = await this.repository.transition(id, {
        situation: VacancySituation.AWAITING_PAYMENT,
        free: false,
        value,
      });
    }

    if (!updated) {
      throw new AppError("Vaga não encontrada", 404);
    }

    // RF28: avisa os administradores de que há PIX a conferir. O erro é
    // engolido de propósito: a vaga JÁ está na fila, e a fila do painel
    // (RF37) é o canal de verdade — o e-mail só apressa. Deixar a exceção
    // subir devolveria 500 ao anunciante por uma vaga que foi enviada com
    // sucesso, e ele tentaria de novo achando que falhou.
    if (updated.situation === VacancySituation.AWAITING_PAYMENT) {
      try {
        await this.paymentNotifier.notifyAdminsOfPendingPaymentService({
          title: updated.title,
          value: updated.value ?? 0,
          referenceCode: updated.referenceCode,
          advertiserName: advertiser.displayName,
        });
      } catch (error) {
        console.error(
          `[vacancy] falha ao avisar admins da vaga ${updated.referenceCode}:`,
          error,
        );
      }
    }

    return toResult(updated);
  }

  // RF28: a tela de pagamento. Só faz sentido para a vaga que está
  // esperando PIX — pedir os dados de pagamento de um rascunho ou de uma
  // vaga já aberta é 409, porque não há pagamento a fazer.
  //
  // O valor vem da LINHA DA VAGA, nunca da tabela de preços: é a cópia do
  // momento do envio (RN-P8). Ler o preço "ao vivo" aqui mostraria ao
  // anunciante um valor diferente do que o admin vai conferir.
  async paymentInfoService(
    responsibleId: string,
    id: string,
  ): Promise<VacancyPaymentInfo> {
    const advertiserId = await this.advertiserOf(responsibleId);
    const vacancy = await this.ownedOrFail(id, advertiserId);

    if (vacancy.situation !== VacancySituation.AWAITING_PAYMENT) {
      throw new AppError("Esta vaga não está aguardando pagamento", 409);
    }

    return {
      vacancyId: vacancy.id,
      title: vacancy.title,
      // `value` é NOT NULL em toda vaga enviada; o `?? 0` existe só para o
      // tipo, porque a coluna é nula enquanto a vaga é rascunho.
      value: vacancy.value ?? 0,
      referenceCode: vacancy.referenceCode,
      pixKey: await this.settings.valueOfService(SettingKey.PIX_KEY),
      validityDays: VACANCY_VALIDITY_DAYS,
    };
  }

  // RF25: o anunciante encerra quando escolhe o candidato. Encerrada é
  // final e não reabre (RN-VG1) — para continuar contratando, publica-se
  // outra vaga, com novo pagamento (RN-VG3).
  //
  // O cancelamento das candidaturas em andamento e o aviso aos candidatos
  // (RN-VG2) ficam para a task 16, que cria a tabela.
  async closeOwnService(
    responsibleId: string,
    id: string,
  ): Promise<VacancyResult> {
    const advertiserId = await this.advertiserOf(responsibleId);
    const vacancy = await this.ownedOrFail(id, advertiserId);

    if (vacancy.situation === VacancySituation.CLOSED) {
      throw new AppError("Vaga já encerrada", 409);
    }

    if (vacancy.situation === VacancySituation.DRAFT) {
      throw new AppError("Rascunho não é encerrado, é excluído", 409);
    }

    const updated = await this.repository.transition(id, {
      situation: VacancySituation.CLOSED,
      closedAt: new Date(),
    });

    if (!updated) {
      throw new AppError("Vaga não encontrada", 404);
    }

    return toResult(updated);
  }

  // RN-VG6: vaga sem candidaturas pode ser excluída; com candidaturas, só
  // encerrada. A tabela de candidaturas é da task 16, então a trava de hoje
  // é mais forte e não mais fraca: só se exclui vaga que NUNCA foi
  // publicada (`published_at` nulo), ou seja, rascunho e vaga parada em
  // aguardando pagamento.
  //
  // O critério é "nunca publicada" e não "não está aberta" por causa da
  // RN-P1: a gratuita é decidida no envio e gravada na linha, então apagar
  // a linha devolve o direito. Com a trava na situação, bastava publicar a
  // gratuita, encerrá-la e excluí-la para ganhar outra — vagas gratuitas
  // infinitas. Uma vaga que já esteve no ar também pode ter recebido
  // candidatura, e some do histórico junto com ela.
  async deleteOwnService(responsibleId: string, id: string): Promise<void> {
    const advertiserId = await this.advertiserOf(responsibleId);
    const vacancy = await this.ownedOrFail(id, advertiserId);

    if (vacancy.publishedAt !== null) {
      throw new AppError(
        "Vaga que já foi publicada não é excluída, é encerrada",
        409,
      );
    }

    await this.repository.remove(id);
  }
}

// RN-VG2 / RN-P4: 60 dias a partir da publicação, sem renovação.
function expiryFrom(publishedAt: Date): Date {
  const expiry = new Date(publishedAt);
  expiry.setUTCDate(expiry.getUTCDate() + VACANCY_VALIDITY_DAYS);

  return expiry;
}
