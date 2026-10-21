// POR QUE EXISTE: o envio é o único ponto do sistema em que dinheiro entra
// na conversa, e três regras se cruzam nele. A vaga gratuita é a primeira e
// só ela (RN-P1); vaga paga exige verificação ANTES do PIX, para ninguém
// pagar e ser recusado depois (RN-P2); e o preço é COPIADO no envio, porque
// a RN-P8 proíbe que uma alteração de preço alcance o que já foi cobrado.
// A metade da RN-P8 que a task 12 não pôde fechar — a cópia em si — é aqui.
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
  createVacancy,
  DEFAULT_PASSWORD,
  vacancyPayload,
} from "../../utils/fixtures";
import {
  AdvertiserType,
  VerificationStatus,
} from "@/modules/advertiser/types/AdvertiserEnums";
import {
  VACANCY_VALIDITY_DAYS,
  VacancySituation,
} from "@/modules/vacancy/types/VacancyEnums";
import { Vacancy } from "@/modules/vacancy/schema/Vacancy.schema";
import { VacancyType } from "@/shared/types/VacancyType";

let ctx: TestContext;

const VACANCIES = "/api/v1/vacancies";

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
});

// Um anunciante com responsável logado, no estado de verificação pedido.
async function advertiserLoggedIn(
  options: {
    verification?: VerificationStatus;
    type?: AdvertiserType;
    document?: string;
  } = {},
) {
  const { advertiser, responsible } = await createAdvertiser(
    ctx.dataSource,
    ctx.hasher,
    {
      verification: options.verification ?? VerificationStatus.PENDING,
      type: options.type ?? AdvertiserType.COMPANY,
      document:
        options.document ??
        (options.type === AdvertiserType.INDIVIDUAL
          ? "52998224725"
          : "11222333000181"),
      email: `resp_${Math.random().toString(36).slice(2)}@test.local`,
    },
  );
  const token = (await loginAs(ctx, responsible.email, DEFAULT_PASSWORD)).token;

  return { advertiser, responsible, token };
}

async function draft(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const res = await ctx.request
    .post(VACANCIES)
    .set(authHeader(token))
    .send(vacancyPayload(overrides))
    .expect(201);

  return res.body.data.id;
}

function submit(token: string, id: string) {
  return ctx.request
    .post(`${VACANCIES}/${id}/submit`)
    .set(authHeader(token))
    .send({ confirmed: true });
}

describe("RN-P1 — a primeira vaga é gratuita", () => {
  it("a gratuita abre na hora, com validade de 60 dias", async () => {
    const { token } = await advertiserLoggedIn();

    const res = await submit(token, await draft(token)).expect(200);

    // Não há PIX a esperar, então ela não para em aguardando_pagamento.
    expect(res.body.data).toMatchObject({
      situation: VacancySituation.OPEN,
      free: true,
      value: 0,
    });
    expect(res.body.data.publishedAt).not.toBeNull();

    // RN-P4: 60 dias contados da publicação, sem renovação.
    const published = new Date(res.body.data.publishedAt).getTime();
    const expires = new Date(res.body.data.expiresAt).getTime();
    const dias = Math.round((expires - published) / 86_400_000);
    expect(dias).toBe(VACANCY_VALIDITY_DAYS);
  });

  it("o rascunho não consome a gratuita — só o envio consome", async () => {
    const { token } = await advertiserLoggedIn({
      verification: VerificationStatus.VERIFIED,
    });

    // Dois rascunhos parados; o primeiro ENVIADO é que fica gratuito.
    await draft(token);
    const segundo = await draft(token);

    const res = await submit(token, segundo).expect(200);
    expect(res.body.data.free).toBe(true);
  });

  it("a segunda vaga é paga, com o preço do tipo", async () => {
    const { token } = await advertiserLoggedIn({
      verification: VerificationStatus.VERIFIED,
    });

    await submit(token, await draft(token)).expect(200);

    const res = await submit(token, await draft(token)).expect(200);

    // RN-P3: para em aguardando_pagamento; quem abre é a task 14, ao
    // confirmar o PIX.
    expect(res.body.data).toMatchObject({
      situation: VacancySituation.AWAITING_PAYMENT,
      free: false,
      value: 5,
    });
    expect(res.body.data.publishedAt).toBeNull();
  });
});

describe("RN-P2 / RN-V4 — só o verificado publica vaga paga", () => {
  it("não verificado publica a gratuita", async () => {
    const { token } = await advertiserLoggedIn({
      verification: VerificationStatus.PENDING,
    });

    await submit(token, await draft(token)).expect(200);
  });

  it("não verificado é bloqueado na segunda vaga, antes do PIX", async () => {
    const { token } = await advertiserLoggedIn({
      verification: VerificationStatus.PENDING,
    });

    await submit(token, await draft(token)).expect(200);

    const res = await submit(token, await draft(token)).expect(403);

    expect(res.body.message).toMatch(/não verificado/i);
  });

  it("anunciante recusado também não publica vaga paga", async () => {
    const { token } = await advertiserLoggedIn({
      verification: VerificationStatus.REJECTED,
    });

    await submit(token, await draft(token)).expect(200);
    await submit(token, await draft(token)).expect(403);
  });
});

describe("RN-P8 — o preço é copiado no envio", () => {
  it("alteração de preço depois do envio não alcança a vaga", async () => {
    const { token } = await advertiserLoggedIn({
      verification: VerificationStatus.VERIFIED,
    });
    const admin = await createAdmin(ctx.dataSource, ctx.hasher);
    const adminJwt = (await loginAs(ctx, admin.email, DEFAULT_PASSWORD)).token;

    // Gasta a gratuita para a próxima ser paga.
    await submit(token, await draft(token)).expect(200);

    const paga = await submit(token, await draft(token)).expect(200);
    expect(paga.body.data.value).toBe(5);

    await ctx.request
      .patch(`/api/v1/admin/vacancy-prices/${VacancyType.INTERNSHIP}`)
      .set(authHeader(adminJwt))
      .send({ value: 99 })
      .expect(200);

    // A vaga carrega a cópia: é este valor que vai no PIX, não o novo.
    const depois = await ctx.request
      .get(`${VACANCIES}/${paga.body.data.id}`)
      .set(authHeader(token))
      .expect(200);

    expect(depois.body.data.value).toBe(5);
  });

  it("vaga enviada depois da alteração usa o preço novo", async () => {
    const { token } = await advertiserLoggedIn({
      verification: VerificationStatus.VERIFIED,
    });
    const admin = await createAdmin(ctx.dataSource, ctx.hasher);
    const adminJwt = (await loginAs(ctx, admin.email, DEFAULT_PASSWORD)).token;

    await submit(token, await draft(token)).expect(200);

    await ctx.request
      .patch(`/api/v1/admin/vacancy-prices/${VacancyType.INTERNSHIP}`)
      .set(authHeader(adminJwt))
      .send({ value: 99 })
      .expect(200);

    const res = await submit(token, await draft(token)).expect(200);

    expect(res.body.data.value).toBe(99);
  });
});

describe("RN-V3a — pessoa física tem no máximo 3 vagas abertas", () => {
  it("a quarta vaga aberta é recusada, mesmo verificada", async () => {
    const { advertiser, responsible, token } = await advertiserLoggedIn({
      type: AdvertiserType.INDIVIDUAL,
      verification: VerificationStatus.VERIFIED,
    });

    // Três já abertas, inseridas direto: chegar lá pela rota exigiria
    // confirmar três PIX, que é a task 14.
    for (let i = 0; i < 3; i += 1) {
      await createVacancy(ctx.dataSource, advertiser.id, responsible.id, {
        situation: VacancySituation.OPEN,
        publishedAt: new Date(),
        free: i === 0,
        value: i === 0 ? 0 : 5,
      });
    }

    const res = await submit(token, await draft(token)).expect(409);

    expect(res.body.message).toMatch(/3 vagas abertas/);
  });

  it("vaga encerrada não conta para o limite", async () => {
    const { advertiser, responsible, token } = await advertiserLoggedIn({
      type: AdvertiserType.INDIVIDUAL,
      verification: VerificationStatus.VERIFIED,
    });

    for (let i = 0; i < 3; i += 1) {
      await createVacancy(ctx.dataSource, advertiser.id, responsible.id, {
        situation: VacancySituation.CLOSED,
        publishedAt: new Date(),
        closedAt: new Date(),
        free: i === 0,
        value: i === 0 ? 0 : 5,
      });
    }

    await submit(token, await draft(token)).expect(200);
  });

  it("o limite não vale para pessoa jurídica", async () => {
    const { advertiser, responsible, token } = await advertiserLoggedIn({
      type: AdvertiserType.COMPANY,
      verification: VerificationStatus.VERIFIED,
    });

    for (let i = 0; i < 3; i += 1) {
      await createVacancy(ctx.dataSource, advertiser.id, responsible.id, {
        situation: VacancySituation.OPEN,
        publishedAt: new Date(),
        free: i === 0,
        value: i === 0 ? 0 : 5,
      });
    }

    await submit(token, await draft(token)).expect(200);
  });
});

describe("RN-VG1 — o rascunho é o único estado que se envia", () => {
  it("enviar duas vezes dá 409", async () => {
    const { token } = await advertiserLoggedIn();
    const id = await draft(token);

    await submit(token, id).expect(200);
    await submit(token, id).expect(409);
  });

  it("anunciante inativo não publica", async () => {
    const { advertiser, token } = await advertiserLoggedIn();
    const id = await draft(token);

    await ctx.dataSource
      .getRepository("advertisers")
      .update({ id: advertiser.id }, { active: false });

    const res = await submit(token, id).expect(403);
    expect(res.body.message).toMatch(/inativo/i);
  });
});

describe("RF25 — encerrar a vaga", () => {
  it("vaga aberta é encerrada e não reabre", async () => {
    const { token } = await advertiserLoggedIn();
    const id = await draft(token);
    await submit(token, id).expect(200);

    const res = await ctx.request
      .post(`${VACANCIES}/${id}/close`)
      .set(authHeader(token))
      .expect(200);

    expect(res.body.data.situation).toBe(VacancySituation.CLOSED);
    expect(res.body.data.closedAt).not.toBeNull();

    // Encerrada é final (RN-VG1): não há rota que a traga de volta, e
    // encerrar de novo é 409.
    await ctx.request
      .post(`${VACANCIES}/${id}/close`)
      .set(authHeader(token))
      .expect(409);
  });

  it("rascunho não é encerrado, é excluído", async () => {
    const { token } = await advertiserLoggedIn();

    const res = await ctx.request
      .post(`${VACANCIES}/${await draft(token)}/close`)
      .set(authHeader(token))
      .expect(409);

    expect(res.body.message).toMatch(/excluído/i);
  });
});

describe("RN-VG6 — excluir vaga", () => {
  it("rascunho é excluído", async () => {
    const { token } = await advertiserLoggedIn();
    const id = await draft(token);

    await ctx.request
      .delete(`${VACANCIES}/${id}`)
      .set(authHeader(token))
      .expect(204);

    expect(
      await ctx.dataSource.getRepository(Vacancy).findOne({ where: { id } }),
    ).toBeNull();
  });

  it("vaga aberta não é excluída, é encerrada", async () => {
    const { token } = await advertiserLoggedIn();
    const id = await draft(token);
    await submit(token, id).expect(200);

    const res = await ctx.request
      .delete(`${VACANCIES}/${id}`)
      .set(authHeader(token))
      .expect(409);

    expect(res.body.message).toMatch(/é encerrada/i);
  });

  it("vaga encerrada também não é excluída — senão a gratuita seria infinita", async () => {
    const { token } = await advertiserLoggedIn();
    const id = await draft(token);
    await submit(token, id).expect(200);

    await ctx.request
      .post(`${VACANCIES}/${id}/close`)
      .set(authHeader(token))
      .expect(200);

    // A trava é "já foi publicada", não "está aberta": a RN-P1 grava o
    // direito à gratuita na linha da vaga, então apagá-la o devolveria.
    // Publicar a gratuita, encerrar e excluir daria vagas gratuitas sem
    // fim — e uma vaga que esteve no ar pode ter recebido candidatura.
    const res = await ctx.request
      .delete(`${VACANCIES}/${id}`)
      .set(authHeader(token))
      .expect(409);

    expect(res.body.message).toMatch(/já foi publicada/i);
  });

  it("vaga aguardando pagamento é excluída: nunca esteve no ar", async () => {
    const { token } = await advertiserLoggedIn({
      verification: VerificationStatus.VERIFIED,
    });

    await submit(token, await draft(token)).expect(200);
    const paga = await submit(token, await draft(token)).expect(200);

    await ctx.request
      .delete(`${VACANCIES}/${paga.body.data.id}`)
      .set(authHeader(token))
      .expect(204);
  });
});
