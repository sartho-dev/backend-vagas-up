// POR QUE EXISTE: a vaga é o objeto que o anunciante PAGA para publicar, e
// tudo o que o candidato vê vem daqui. O rascunho tem de aceitar edição
// livre, a posse tem de ser filtro de banco (vaga alheia não existe, não é
// proibida) e só o responsável entra — candidato e admin não publicam vaga.
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
import { VacancySituation } from "@/modules/vacancy/types/VacancyEnums";
import { VacancyType } from "@/shared/types/VacancyType";

let ctx: TestContext;
let responsibleJwt: string;
let advertiserId: string;
let responsibleId: string;

const VACANCIES = "/api/v1/vacancies";

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  const { advertiser, responsible } = await createAdvertiser(
    ctx.dataSource,
    ctx.hasher,
  );
  advertiserId = advertiser.id;
  responsibleId = responsible.id;
  responsibleJwt = (await loginAs(ctx, responsible.email, DEFAULT_PASSWORD))
    .token;
});

describe("RF24 — criar rascunho de vaga", () => {
  it("nasce rascunho, sem valor, sem publicação e com código de referência", async () => {
    const res = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload())
      .expect(201);

    expect(res.body.data).toMatchObject({
      advertiserId,
      createdBy: responsibleId,
      situation: VacancySituation.DRAFT,
      free: false,
      value: null,
      publishedAt: null,
      expiresAt: null,
      positions: 1,
      requiresAdult: false,
    });
    // RN-P3: curto e sem caracteres ambíguos, porque alguém o digita no PIX.
    expect(res.body.data.referenceCode).toMatch(/^[2-9A-HJ-NP-TV-Z]{8}$/);
  });

  it("devolve a unidade da carga horária junto com o número (RN-VG4)", async () => {
    const estagio = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload({ workHours: 30 }))
      .expect(201);

    expect(estagio.body.data.workHoursUnit).toBe("semanal");

    const aprendiz = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload({ type: VacancyType.APPRENTICE, workHours: 6 }))
      .expect(201);

    // 6 aqui são 6 h DIÁRIAS — o número sozinho seria ambíguo.
    expect(aprendiz.body.data.workHoursUnit).toBe("diaria");
  });

  it("o código de referência é único entre vagas", async () => {
    const codes = new Set<string>();

    for (let i = 0; i < 5; i += 1) {
      const res = await ctx.request
        .post(VACANCIES)
        .set(authHeader(responsibleJwt))
        .send(vacancyPayload())
        .expect(201);
      codes.add(res.body.data.referenceCode);
    }

    expect(codes.size).toBe(5);
  });
});

describe("listar e ver a própria vaga", () => {
  it("lista só as vagas do próprio anunciante", async () => {
    await createVacancy(ctx.dataSource, advertiserId, responsibleId);

    const outro = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: "04252011000110",
      email: "outro@test.local",
    });
    await createVacancy(
      ctx.dataSource,
      outro.advertiser.id,
      outro.responsible.id,
    );

    const res = await ctx.request
      .get(VACANCIES)
      .set(authHeader(responsibleJwt))
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].advertiserId).toBe(advertiserId);
  });

  it("vaga de outro anunciante dá 404, não 403", async () => {
    const outro = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: "04252011000110",
      email: "outro2@test.local",
    });
    const alheia = await createVacancy(
      ctx.dataSource,
      outro.advertiser.id,
      outro.responsible.id,
    );

    // 404 e não 403: a posse é filtro de banco, então nesse escopo a vaga
    // não existe. Um 403 confirmaria que aquele id existe em algum lugar.
    await ctx.request
      .get(`${VACANCIES}/${alheia.id}`)
      .set(authHeader(responsibleJwt))
      .expect(404);
  });
});

describe("RN-P5 — edição antes da publicação", () => {
  it("rascunho aceita edição", async () => {
    const vaga = await createVacancy(
      ctx.dataSource,
      advertiserId,
      responsibleId,
    );

    const res = await ctx.request
      .patch(`${VACANCIES}/${vaga.id}`)
      .set(authHeader(responsibleJwt))
      .send({ title: "Estágio em desenvolvimento back-end" })
      .expect(200);

    expect(res.body.data.title).toBe("Estágio em desenvolvimento back-end");
  });

  it("vaga aguardando pagamento ainda aceita edição", async () => {
    const vaga = await createVacancy(
      ctx.dataSource,
      advertiserId,
      responsibleId,
      {
        situation: VacancySituation.AWAITING_PAYMENT,
        value: 5,
      },
    );

    await ctx.request
      .patch(`${VACANCIES}/${vaga.id}`)
      .set(authHeader(responsibleJwt))
      .send({ city: "Dourados" })
      .expect(200);
  });

  it("PATCH em vaga publicada dá 409", async () => {
    const vaga = await createVacancy(
      ctx.dataSource,
      advertiserId,
      responsibleId,
      {
        situation: VacancySituation.OPEN,
        publishedAt: new Date(),
        free: true,
        value: 0,
      },
    );

    const res = await ctx.request
      .patch(`${VACANCIES}/${vaga.id}`)
      .set(authHeader(responsibleJwt))
      .send({ title: "Outro cargo completamente diferente" })
      .expect(409);

    expect(res.body.message).toMatch(/não pode ser editada/i);
  });

  it("PATCH não publica a vaga por campo escondido no corpo", async () => {
    const vaga = await createVacancy(
      ctx.dataSource,
      advertiserId,
      responsibleId,
    );

    // `situation`, `value` e `free` não são editáveis: o `.strict()` do Zod
    // recusa o corpo em vez de deixar passar uma publicação sem pagamento.
    await ctx.request
      .patch(`${VACANCIES}/${vaga.id}`)
      .set(authHeader(responsibleJwt))
      .send({ situation: VacancySituation.OPEN })
      .expect(400);

    await ctx.request
      .patch(`${VACANCIES}/${vaga.id}`)
      .set(authHeader(responsibleJwt))
      .send({ free: true, value: 0 })
      .expect(400);
  });
});

describe("rota protegida", () => {
  it("sem token: 401", async () => {
    await ctx.request.get(VACANCIES).expect(401);
  });

  it("token de candidato: 403", async () => {
    const student = await createStudent(ctx.dataSource, ctx.hasher);
    const jwt = (await loginAs(ctx, student.email, DEFAULT_PASSWORD)).token;

    await ctx.request.get(VACANCIES).set(authHeader(jwt)).expect(403);
  });

  it("token de administrador: 403 — admin não publica vaga", async () => {
    const admin = await createAdmin(ctx.dataSource, ctx.hasher);
    const jwt = (await loginAs(ctx, admin.email, DEFAULT_PASSWORD)).token;

    await ctx.request.get(VACANCIES).set(authHeader(jwt)).expect(403);
  });

  it("token de responsável: sucesso", async () => {
    await ctx.request
      .get(VACANCIES)
      .set(authHeader(responsibleJwt))
      .expect(200);
  });
});
