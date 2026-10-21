// POR QUE EXISTE: esta tela é a única instrução que o anunciante recebe
// para mandar dinheiro. Se o código de referência não aparecer, ele paga e
// ninguém liga o PIX à vaga (RN-P3); se o valor vier da tabela de preços em
// vez da linha da vaga, ele vê um número e o admin confere outro (RN-P8). E
// o aviso dos 60 dias tem de estar aqui, não só na revisão (RN-P4).
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
  DEFAULT_PASSWORD,
  vacancyPayload,
} from "../../utils/fixtures";
import { VerificationStatus } from "@/modules/advertiser/types/AdvertiserEnums";
import { SettingKey } from "@/modules/pricing/types/PricingEnums";
import { VACANCY_VALIDITY_DAYS } from "@/modules/vacancy/types/VacancyEnums";
import { VacancyType } from "@/shared/types/VacancyType";

let ctx: TestContext;
let adminJwt: string;
let responsibleJwt: string;

const VACANCIES = "/api/v1/vacancies";
const PIX_SETTING = `/api/v1/admin/settings/${SettingKey.PIX_KEY}`;

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  ctx.emailSender.reset();
  const admin = await createAdmin(ctx.dataSource, ctx.hasher);
  adminJwt = (await loginAs(ctx, admin.email, DEFAULT_PASSWORD)).token;

  const { responsible } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
    verification: VerificationStatus.VERIFIED,
  });
  responsibleJwt = (await loginAs(ctx, responsible.email, DEFAULT_PASSWORD))
    .token;
});

// Gasta a gratuita e devolve o id de uma vaga paga aguardando pagamento.
async function awaitingPayment(): Promise<string> {
  for (let i = 0; i < 2; i += 1) {
    const criada = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload())
      .expect(201);
    const enviada = await ctx.request
      .post(`${VACANCIES}/${criada.body.data.id}/submit`)
      .set(authHeader(responsibleJwt))
      .send({ confirmed: true })
      .expect(200);

    if (i === 1) return enviada.body.data.id;
  }

  throw new Error("inalcançável");
}

describe("RF28 — tela de pagamento da vaga", () => {
  it("mostra valor, código de referência e o aviso de validade", async () => {
    await ctx.request
      .patch(PIX_SETTING)
      .set(authHeader(adminJwt))
      .send({ value: "pagamentos@estagiaaqui.com.br" })
      .expect(200);

    const id = await awaitingPayment();

    const res = await ctx.request
      .get(`${VACANCIES}/${id}/payment`)
      .set(authHeader(responsibleJwt))
      .expect(200);

    expect(res.body.data).toMatchObject({
      vacancyId: id,
      value: 5,
      pixKey: "pagamentos@estagiaaqui.com.br",
      // RN-P4: o aviso aparece na revisão E aqui.
      validityDays: VACANCY_VALIDITY_DAYS,
    });
    // RN-P3: sem ele o pagamento não se liga à vaga.
    expect(res.body.data.referenceCode).toMatch(/^[2-9A-HJ-NP-TV-Z]{8}$/);
  });

  it("chave PIX não configurada vem null, sem derrubar o envio", async () => {
    // Travar a publicação por uma configuração vazia deixaria o anunciante
    // sem saída nenhuma — a tela avisa e ele fala com o administrador.
    const id = await awaitingPayment();

    const res = await ctx.request
      .get(`${VACANCIES}/${id}/payment`)
      .set(authHeader(responsibleJwt))
      .expect(200);

    expect(res.body.data.pixKey).toBeNull();
    expect(res.body.data.value).toBe(5);
  });

  it("o valor é o do envio, mesmo que o preço mude depois", async () => {
    const id = await awaitingPayment();

    await ctx.request
      .patch(`/api/v1/admin/vacancy-prices/${VacancyType.INTERNSHIP}`)
      .set(authHeader(adminJwt))
      .send({ value: 99 })
      .expect(200);

    const res = await ctx.request
      .get(`${VACANCIES}/${id}/payment`)
      .set(authHeader(responsibleJwt))
      .expect(200);

    // RN-P8: o anunciante vê o que vai pagar, que é o que o admin vai
    // conferir. Ler o preço ao vivo mostraria 99 e cobraria 5.
    expect(res.body.data.value).toBe(5);
  });

  it("vaga que não está aguardando pagamento é 409", async () => {
    const criada = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload())
      .expect(201);

    // Rascunho: não há pagamento a fazer.
    await ctx.request
      .get(`${VACANCIES}/${criada.body.data.id}/payment`)
      .set(authHeader(responsibleJwt))
      .expect(409);

    // A gratuita abre direto: também não há.
    await ctx.request
      .post(`${VACANCIES}/${criada.body.data.id}/submit`)
      .set(authHeader(responsibleJwt))
      .send({ confirmed: true })
      .expect(200);

    await ctx.request
      .get(`${VACANCIES}/${criada.body.data.id}/payment`)
      .set(authHeader(responsibleJwt))
      .expect(409);
  });

  it("vaga de outro anunciante é 404", async () => {
    const id = await awaitingPayment();

    const outro = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: "04252011000110",
      email: "outro@test.local",
    });
    const jwt = (await loginAs(ctx, outro.responsible.email, DEFAULT_PASSWORD))
      .token;

    await ctx.request
      .get(`${VACANCIES}/${id}/payment`)
      .set(authHeader(jwt))
      .expect(404);
  });
});

describe("RF28 — aviso aos administradores", () => {
  it("o envio da vaga paga avisa os admins ativos, com o código", async () => {
    const outroAdmin = await createAdmin(ctx.dataSource, ctx.hasher, {
      email: "admin2@test.local",
    });
    const inativo = await createAdmin(ctx.dataSource, ctx.hasher, {
      email: "admin3@test.local",
      active: false,
    });
    ctx.emailSender.reset();

    const id = await awaitingPayment();
    const info = await ctx.request
      .get(`${VACANCIES}/${id}/payment`)
      .set(authHeader(responsibleJwt))
      .expect(200);

    const avisos = ctx.emailSender.sent.filter((e) =>
      e.subject.includes(info.body.data.referenceCode),
    );

    // Um por admin ATIVO: o endereço de um administrador não é assunto dos
    // outros, então não há cópia coletiva.
    expect(avisos).toHaveLength(2);
    expect(avisos.map((a) => a.to).sort()).toContain(outroAdmin.email);
    // RF34: admin desativado não recebe mais nada do sistema.
    expect(avisos.map((a) => a.to)).not.toContain(inativo.email);
    expect(avisos[0].body).toMatch(/R\$ 5\.00/);
  });

  it("a vaga gratuita não avisa ninguém: não há PIX a conferir", async () => {
    const criada = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload())
      .expect(201);
    ctx.emailSender.reset();

    await ctx.request
      .post(`${VACANCIES}/${criada.body.data.id}/submit`)
      .set(authHeader(responsibleJwt))
      .send({ confirmed: true })
      .expect(200);

    expect(ctx.emailSender.sent).toHaveLength(0);
  });
});
