// POR QUE EXISTE: a fila é o painel onde o administrador trabalha todo dia,
// e ela só serve se o código de referência estiver visível — é por ele, e
// só por ele, que se acha o PIX no extrato (RN-P3). A ordem também importa:
// quem enviou primeiro espera menos. E "pagamentos por período" é o número
// que vira receita no fim do mês, então a soma não pode ser a da página.
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
} from "../../utils/fixtures";
import { VerificationStatus } from "@/modules/advertiser/types/AdvertiserEnums";
import { PaymentSituation } from "@/modules/payment/types/PaymentEnums";
import { VacancySituation } from "@/modules/vacancy/types/VacancyEnums";

let ctx: TestContext;
let adminJwt: string;

const PAYMENTS = "/api/v1/admin/payments";

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  ctx.emailSender.reset();
  const admin = await createAdmin(ctx.dataSource, ctx.hasher);
  adminJwt = (await loginAs(ctx, admin.email, DEFAULT_PASSWORD)).token;
});

describe("RF37 — fila de vagas aguardando pagamento", () => {
  it("mostra código de referência, valor e o anunciante", async () => {
    const { advertiser, responsible } = await createAdvertiser(
      ctx.dataSource,
      ctx.hasher,
      { verification: VerificationStatus.VERIFIED },
    );
    await createVacancy(ctx.dataSource, advertiser.id, responsible.id, {
      situation: VacancySituation.AWAITING_PAYMENT,
      value: 5,
      referenceCode: "ABCD2345",
      title: "Estágio em marketing",
    });

    const res = await ctx.request
      .get(`${PAYMENTS}/queue`)
      .set(authHeader(adminJwt))
      .expect(200);

    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0]).toMatchObject({
      title: "Estágio em marketing",
      value: 5,
      // Sem isto o admin não acha o PIX no extrato e a vaga fica parada.
      referenceCode: "ABCD2345",
      advertiserName: advertiser.displayName,
      advertiserDocument: advertiser.document,
      advertiserVerification: VerificationStatus.VERIFIED,
    });
  });

  it("só lista vagas aguardando pagamento", async () => {
    const { advertiser, responsible } = await createAdvertiser(
      ctx.dataSource,
      ctx.hasher,
    );

    for (const situation of [
      VacancySituation.DRAFT,
      VacancySituation.OPEN,
      VacancySituation.CLOSED,
    ]) {
      await createVacancy(ctx.dataSource, advertiser.id, responsible.id, {
        situation,
        publishedAt: situation === VacancySituation.DRAFT ? null : new Date(),
      });
    }
    await createVacancy(ctx.dataSource, advertiser.id, responsible.id, {
      situation: VacancySituation.AWAITING_PAYMENT,
      value: 5,
    });

    const res = await ctx.request
      .get(`${PAYMENTS}/queue`)
      .set(authHeader(adminJwt))
      .expect(200);

    expect(res.body.data.total).toBe(1);
  });

  it("mostra o anunciante que perdeu a verificação, para o admin ver o motivo", async () => {
    // A vaga chegou à fila verificada e o anunciante trocou de nome depois
    // (RF23 devolve para pendente). Ela não pode ser confirmada, mas tem de
    // APARECER — senão ela desaparece da fila e ninguém entende por quê.
    const { advertiser, responsible } = await createAdvertiser(
      ctx.dataSource,
      ctx.hasher,
      { verification: VerificationStatus.PENDING },
    );
    await createVacancy(ctx.dataSource, advertiser.id, responsible.id, {
      situation: VacancySituation.AWAITING_PAYMENT,
      value: 5,
    });

    const res = await ctx.request
      .get(`${PAYMENTS}/queue`)
      .set(authHeader(adminJwt))
      .expect(200);

    expect(res.body.data.items[0].advertiserVerification).toBe(
      VerificationStatus.PENDING,
    );
  });

  it("pagina sem repetir nem pular linha", async () => {
    const { advertiser, responsible } = await createAdvertiser(
      ctx.dataSource,
      ctx.hasher,
    );
    for (let i = 0; i < 5; i += 1) {
      await createVacancy(ctx.dataSource, advertiser.id, responsible.id, {
        situation: VacancySituation.AWAITING_PAYMENT,
        value: 5,
      });
    }

    const p1 = await ctx.request
      .get(`${PAYMENTS}/queue?page=1&limit=2`)
      .set(authHeader(adminJwt))
      .expect(200);
    const p2 = await ctx.request
      .get(`${PAYMENTS}/queue?page=2&limit=2`)
      .set(authHeader(adminJwt))
      .expect(200);

    expect(p1.body.data.total).toBe(5);
    const ids = [
      ...p1.body.data.items.map((i: { vacancyId: string }) => i.vacancyId),
      ...p2.body.data.items.map((i: { vacancyId: string }) => i.vacancyId),
    ];
    expect(new Set(ids).size).toBe(4);
  });
});

describe("RF37 — pagamentos por período", () => {
  // Monta pagamentos já decididos direto no banco: o que se testa aqui é a
  // consulta, e chegar a cada linha pelas rotas custaria uma vaga inteira.
  async function payment(
    situation: PaymentSituation,
    value: number,
    decidedAt: Date,
  ) {
    const { advertiser, responsible } = await createAdvertiser(
      ctx.dataSource,
      ctx.hasher,
      {
        document: `${Math.floor(Math.random() * 9e10) + 1e10}`.slice(0, 14),
        email: `r_${Math.random().toString(36).slice(2)}@test.local`,
      },
    );
    const vaga = await createVacancy(
      ctx.dataSource,
      advertiser.id,
      responsible.id,
      { situation: VacancySituation.CLOSED, value },
    );

    await ctx.dataSource.query(
      `INSERT INTO "payments" ("vacancy_id", "value", "reference_code", "situation", "decided_by", "decided_at")
       VALUES ($1, $2, $3, $4, (SELECT id FROM admins LIMIT 1), $5)`,
      [vaga.id, value, vaga.referenceCode, situation, decidedAt],
    );
  }

  it("soma o total CONFIRMADO do período, não o da página", async () => {
    const hoje = new Date();
    await payment(PaymentSituation.CONFIRMED, 5, hoje);
    await payment(PaymentSituation.CONFIRMED, 10, hoje);
    await payment(PaymentSituation.CONFIRMED, 20, hoje);
    // Recusado não é receita.
    await payment(PaymentSituation.REFUSED, 100, hoje);
    // Reembolsado também não: o dinheiro volta.
    await payment(PaymentSituation.REFUNDED, 100, hoje);

    const res = await ctx.request
      .get(`${PAYMENTS}?limit=1`)
      .set(authHeader(adminJwt))
      .expect(200);

    // Uma linha na página, mas o total é do período inteiro: 5 + 10 + 20.
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(5);
    expect(res.body.data.confirmedTotal).toBe(35);
  });

  it("filtra por período", async () => {
    const antigo = new Date("2026-01-15T12:00:00Z");
    const recente = new Date("2026-06-15T12:00:00Z");
    await payment(PaymentSituation.CONFIRMED, 5, antigo);
    await payment(PaymentSituation.CONFIRMED, 10, recente);

    const res = await ctx.request
      .get(`${PAYMENTS}?from=2026-06-01T00:00:00Z&to=2026-06-30T23:59:59Z`)
      .set(authHeader(adminJwt))
      .expect(200);

    expect(res.body.data.total).toBe(1);
    expect(res.body.data.confirmedTotal).toBe(10);
  });

  it("filtra por situação", async () => {
    const hoje = new Date();
    await payment(PaymentSituation.CONFIRMED, 5, hoje);
    await payment(PaymentSituation.REFUNDED, 10, hoje);

    const res = await ctx.request
      .get(`${PAYMENTS}?situation=${PaymentSituation.REFUNDED}`)
      .set(authHeader(adminJwt))
      .expect(200);

    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].situation).toBe(PaymentSituation.REFUNDED);
  });

  it("período invertido é 400", async () => {
    await ctx.request
      .get(`${PAYMENTS}?from=2026-06-30T00:00:00Z&to=2026-06-01T00:00:00Z`)
      .set(authHeader(adminJwt))
      .expect(400);
  });
});
