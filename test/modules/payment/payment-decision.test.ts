// POR QUE EXISTE: é aqui que dinheiro vira vaga publicada. O PIX acontece
// FORA do site, então a única coisa que liga o pagamento à publicação é o
// código de referência conferido à mão por um administrador — e esse ato
// tem de ser irrepetível (um pagamento por vaga), auditável (quem, quando,
// quanto) e feito sobre o valor que o anunciante realmente pagou, não o
// preço de hoje (RN-P8). Qualquer uma dessas três falhando é dinheiro
// perdido ou vaga publicada de graça.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createTestContext,
  TestContext,
  loginAs,
  authHeader,
} from "../../utils/app";
import { truncateAll } from "../../setup/truncate";
import {
  createAdmin,
  createAdvertiser,
  createStudent,
  createVacancy,
  DEFAULT_PASSWORD,
  vacancyPayload,
} from "../../utils/fixtures";
import {
  AdvertiserType,
  VerificationStatus,
} from "@/modules/advertiser/types/AdvertiserEnums";
import { PaymentSituation } from "@/modules/payment/types/PaymentEnums";
import { Payment } from "@/modules/payment/schema/Payment.schema";
import {
  VACANCY_VALIDITY_DAYS,
  VacancySituation,
} from "@/modules/vacancy/types/VacancyEnums";
import { Vacancy } from "@/modules/vacancy/schema/Vacancy.schema";
import { VacancyType } from "@/shared/types/VacancyType";

let ctx: TestContext;
let adminJwt: string;
let adminId: string;

const VACANCIES = "/api/v1/vacancies";
const PAYMENTS = "/api/v1/admin/payments";

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  ctx.emailSender.reset();
  const admin = await createAdmin(ctx.dataSource, ctx.hasher);
  adminId = admin.id;
  adminJwt = (await loginAs(ctx, admin.email, DEFAULT_PASSWORD)).token;
});

async function advertiserLoggedIn(
  options: {
    verification?: VerificationStatus;
    type?: AdvertiserType;
  } = {},
) {
  const { advertiser, responsible } = await createAdvertiser(
    ctx.dataSource,
    ctx.hasher,
    {
      verification: options.verification ?? VerificationStatus.VERIFIED,
      type: options.type ?? AdvertiserType.COMPANY,
      document:
        options.type === AdvertiserType.INDIVIDUAL
          ? "52998224725"
          : "11222333000181",
      email: `resp_${Math.random().toString(36).slice(2)}@test.local`,
    },
  );
  const token = (await loginAs(ctx, responsible.email, DEFAULT_PASSWORD)).token;

  return { advertiser, responsible, token };
}

// Gasta a vaga gratuita e devolve uma vaga PAGA em aguardando_pagamento,
// que é o estado de onde o admin decide.
async function awaitingPayment(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; value: number; referenceCode: string }> {
  const first = await ctx.request
    .post(VACANCIES)
    .set(authHeader(token))
    .send(vacancyPayload())
    .expect(201);
  await ctx.request
    .post(`${VACANCIES}/${first.body.data.id}/submit`)
    .set(authHeader(token))
    .send({ confirmed: true })
    .expect(200);

  const paid = await ctx.request
    .post(VACANCIES)
    .set(authHeader(token))
    .send(vacancyPayload(overrides))
    .expect(201);
  const submitted = await ctx.request
    .post(`${VACANCIES}/${paid.body.data.id}/submit`)
    .set(authHeader(token))
    .send({ confirmed: true })
    .expect(200);

  expect(submitted.body.data.situation).toBe(VacancySituation.AWAITING_PAYMENT);

  return {
    id: submitted.body.data.id,
    value: submitted.body.data.value,
    referenceCode: submitted.body.data.referenceCode,
  };
}

describe("RF37 — confirmar o pagamento", () => {
  it("publica a vaga e registra quem confirmou, quando e quanto", async () => {
    const { token } = await advertiserLoggedIn();
    const vaga = await awaitingPayment(token);

    const res = await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/confirm`)
      .set(authHeader(adminJwt))
      .send({ note: null })
      .expect(201);

    // RN-P7: valor, data, código e quem decidiu. Nada de comprovante.
    expect(res.body.data).toMatchObject({
      vacancyId: vaga.id,
      value: vaga.value,
      referenceCode: vaga.referenceCode,
      situation: PaymentSituation.CONFIRMED,
      decidedBy: adminId,
    });
    expect(res.body.data.decidedAt).not.toBeNull();

    const publicada = await ctx.dataSource
      .getRepository(Vacancy)
      .findOne({ where: { id: vaga.id } });

    expect(publicada!.situation).toBe(VacancySituation.OPEN);
    expect(publicada!.publishedAt).not.toBeNull();

    // RN-P4: os 60 dias contam da PUBLICAÇÃO, não do envio — entre os dois
    // podem passar dias esperando o PIX.
    const dias = Math.round(
      (publicada!.expiresAt!.getTime() - publicada!.publishedAt!.getTime()) /
        86_400_000,
    );
    expect(dias).toBe(VACANCY_VALIDITY_DAYS);
  });

  it("avisa os responsáveis por e-mail de que a vaga está no ar", async () => {
    const { responsible, token } = await advertiserLoggedIn();
    const vaga = await awaitingPayment(token);
    ctx.emailSender.reset();

    await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/confirm`)
      .set(authHeader(adminJwt))
      .send({ note: null })
      .expect(201);

    const aviso = ctx.emailSender.sent.find((e) => e.to === responsible.email);
    expect(aviso?.subject).toMatch(/publicada/i);
    // O e-mail diz que não há renovação: é a pergunta que o anunciante faria
    // no dia 59, e a RN-P4 não deixa margem.
    expect(aviso?.body).toMatch(/60 dias/);
  });

  it("confirmar duas vezes é 409 — um pagamento por vaga", async () => {
    const { token } = await advertiserLoggedIn();
    const vaga = await awaitingPayment(token);

    await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/confirm`)
      .set(authHeader(adminJwt))
      .send({ note: null })
      .expect(201);

    // A segunda cai na situação da vaga (já aberta), antes mesmo do UK.
    await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/confirm`)
      .set(authHeader(adminJwt))
      .send({ note: null })
      .expect(409);

    expect(await ctx.dataSource.getRepository(Payment).count()).toBe(1);
  });

  it("vaga que não está aguardando pagamento é 409", async () => {
    const { advertiser, responsible } = await advertiserLoggedIn();
    const rascunho = await createVacancy(
      ctx.dataSource,
      advertiser.id,
      responsible.id,
    );

    await ctx.request
      .post(`${PAYMENTS}/${rascunho.id}/confirm`)
      .set(authHeader(adminJwt))
      .send({ note: null })
      .expect(409);
  });

  it("vaga inexistente é 404", async () => {
    await ctx.request
      .post(`${PAYMENTS}/4a6cdbbb-4c58-4a5e-96f1-1b2c3d4e5f60/confirm`)
      .set(authHeader(adminJwt))
      .send({ note: null })
      .expect(404);
  });
});

describe("RN-P8 — o PIX é no valor do envio, não no preço de hoje", () => {
  it("preço alterado entre o envio e a confirmação não muda o pagamento", async () => {
    const { token } = await advertiserLoggedIn();
    const vaga = await awaitingPayment(token);
    expect(vaga.value).toBe(5);

    // O admin dobra o preço do estágio DEPOIS de a vaga entrar na fila.
    await ctx.request
      .patch(`/api/v1/admin/vacancy-prices/${VacancyType.INTERNSHIP}`)
      .set(authHeader(adminJwt))
      .send({ value: 99 })
      .expect(200);

    const res = await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/confirm`)
      .set(authHeader(adminJwt))
      .send({ note: null })
      .expect(201);

    // O anunciante pagou 5 e é 5 que fica no registro contábil. Reler a
    // tabela de preços aqui registraria uma cobrança que nunca houve.
    expect(res.body.data.value).toBe(5);

    const saved = await ctx.dataSource
      .getRepository(Payment)
      .findOne({ where: { vacancyId: vaga.id } });
    expect(saved!.value).toBe(5);
  });
});

describe("reconferência na confirmação", () => {
  it("anunciante que perdeu a verificação não tem a vaga publicada", async () => {
    const { advertiser, token } = await advertiserLoggedIn();
    const vaga = await awaitingPayment(token);

    // RF23: trocar o nome devolve o anunciante para pendente. A vaga paga
    // não pode abrir com um selo que ele não tem mais (RN-P2).
    await ctx.dataSource
      .getRepository("advertisers")
      .update(
        { id: advertiser.id },
        { verification: VerificationStatus.PENDING },
      );

    const res = await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/confirm`)
      .set(authHeader(adminJwt))
      .send({ note: null })
      .expect(409);

    expect(res.body.message).toMatch(/não está verificado/i);
    // Nada gravado: o pagamento não existe se a vaga não foi publicada.
    expect(await ctx.dataSource.getRepository(Payment).count()).toBe(0);
  });

  it("anunciante desativado não tem a vaga publicada", async () => {
    const { advertiser, token } = await advertiserLoggedIn();
    const vaga = await awaitingPayment(token);

    await ctx.dataSource
      .getRepository("advertisers")
      .update({ id: advertiser.id }, { active: false });

    const res = await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/confirm`)
      .set(authHeader(adminJwt))
      .send({ note: null })
      .expect(409);

    expect(res.body.message).toMatch(/inativo/i);
  });

  it("RN-V3a: pessoa física que estourou 3 abertas na espera é recusada", async () => {
    const { advertiser, responsible, token } = await advertiserLoggedIn({
      type: AdvertiserType.INDIVIDUAL,
    });
    const vaga = await awaitingPayment(token);

    // A vaga gratuita já abriu uma; mais duas chegam a 3 enquanto esta
    // espera o PIX. A confirmação é o último ponto em que dá para impedir
    // a quarta — por isso a checagem acontece nos DOIS momentos.
    for (let i = 0; i < 2; i += 1) {
      await createVacancy(ctx.dataSource, advertiser.id, responsible.id, {
        situation: VacancySituation.OPEN,
        publishedAt: new Date(),
        value: 5,
      });
    }

    const res = await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/confirm`)
      .set(authHeader(adminJwt))
      .send({ note: null })
      .expect(409);

    expect(res.body.message).toMatch(/3 vagas abertas/);
  });
});

describe("RN-P6 — recusar o pagamento", () => {
  it("sem dinheiro recebido grava `recusado` e encerra a vaga", async () => {
    const { token } = await advertiserLoggedIn();
    const vaga = await awaitingPayment(token);

    const res = await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/reject`)
      .set(authHeader(adminJwt))
      .send({
        reason: "Nenhum PIX com este código no extrato",
        moneyReceived: false,
      })
      .expect(201);

    expect(res.body.data).toMatchObject({
      situation: PaymentSituation.REFUSED,
      decidedBy: adminId,
    });

    // A recusa é terminal: encerrada não reabre (RN-VG1). O anunciante
    // publica outra, como a RN-P5 manda para erro achado depois do envio.
    const vagaDepois = await ctx.dataSource
      .getRepository(Vacancy)
      .findOne({ where: { id: vaga.id } });
    expect(vagaDepois!.situation).toBe(VacancySituation.CLOSED);
    expect(vagaDepois!.publishedAt).toBeNull();
  });

  it("com dinheiro recebido grava `reembolsado`", async () => {
    const { token } = await advertiserLoggedIn();
    const vaga = await awaitingPayment(token);

    const res = await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/reject`)
      .set(authHeader(adminJwt))
      .send({
        reason: "PIX recebido, mas a descrição da vaga viola as regras",
        moneyReceived: true,
      })
      .expect(201);

    // RN-P6: o reembolso só existe antes da publicação, e é exatamente
    // este caso — o dinheiro chegou e a vaga não vai ao ar.
    expect(res.body.data.situation).toBe(PaymentSituation.REFUNDED);
  });

  it("recusa sem motivo é 400", async () => {
    const { token } = await advertiserLoggedIn();
    const vaga = await awaitingPayment(token);

    await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/reject`)
      .set(authHeader(adminJwt))
      .send({ moneyReceived: false })
      .expect(400);

    // `moneyReceived` também não tem padrão: a resposta decide se alguém
    // vai devolver dinheiro, então o admin tem de dizer.
    await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/reject`)
      .set(authHeader(adminJwt))
      .send({ reason: "Motivo suficientemente longo" })
      .expect(400);
  });

  it("o e-mail de recusa diz se há valor a devolver", async () => {
    const { responsible, token } = await advertiserLoggedIn();
    const vaga = await awaitingPayment(token);
    ctx.emailSender.reset();

    await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/reject`)
      .set(authHeader(adminJwt))
      .send({
        reason: "PIX recebido mas a vaga viola as regras",
        moneyReceived: true,
      })
      .expect(201);

    const aviso = ctx.emailSender.sent.find((e) => e.to === responsible.email);
    expect(aviso?.body).toMatch(/devolvido por PIX/i);
    // O motivo vai no e-mail: vaga encerrada sem explicação gera suporte.
    expect(aviso?.body).toMatch(/viola as regras/);
  });

  it("recusar depois de confirmar é 409", async () => {
    const { token } = await advertiserLoggedIn();
    const vaga = await awaitingPayment(token);

    await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/confirm`)
      .set(authHeader(adminJwt))
      .send({ note: null })
      .expect(201);

    await ctx.request
      .post(`${PAYMENTS}/${vaga.id}/reject`)
      .set(authHeader(adminJwt))
      .send({
        reason: "Mudei de ideia depois de publicar",
        moneyReceived: true,
      })
      .expect(409);
  });
});

describe("rota protegida", () => {
  it("sem token: 401", async () => {
    await ctx.request.get(`${PAYMENTS}/queue`).expect(401);
  });

  it("token de responsável: 403 — anunciante não confirma o próprio PIX", async () => {
    const { token } = await advertiserLoggedIn();

    await ctx.request
      .get(`${PAYMENTS}/queue`)
      .set(authHeader(token))
      .expect(403);
  });

  it("token de candidato: 403", async () => {
    const student = await createStudent(ctx.dataSource, ctx.hasher);
    const jwt = (await loginAs(ctx, student.email, DEFAULT_PASSWORD)).token;

    await ctx.request.get(`${PAYMENTS}/queue`).set(authHeader(jwt)).expect(403);
  });

  it("token de administrador: sucesso", async () => {
    await ctx.request
      .get(`${PAYMENTS}/queue`)
      .set(authHeader(adminJwt))
      .expect(200);
  });
});
