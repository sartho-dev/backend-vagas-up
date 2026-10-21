// POR QUE EXISTE: três destas regras são LEI, não preferência do produto —
// carga horária de estágio (Lei 11.788/2008 art. 10), de jovem aprendiz
// (CLT art. 432) e a proibição de anúncio com faixa de idade (Lei
// 9.029/1995). Uma vaga publicada fora delas expõe o site e o anunciante,
// e nenhum teste de caminho feliz pegaria isso.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createTestContext,
  TestContext,
  loginAs,
  authHeader,
} from "../../utils/app";
import { truncateAll } from "../../setup/truncate";
import {
  createAdvertiser,
  createVacancy,
  DEFAULT_PASSWORD,
  vacancyPayload,
} from "../../utils/fixtures";
import { VacancyType } from "@/shared/types/VacancyType";

let ctx: TestContext;
let responsibleJwt: string;
let advertiserId: string;
let responsibleId: string;

const VACANCIES = "/api/v1/vacancies";

function daysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString();
}

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

describe("RN-VG4 — carga horária máxima por tipo", () => {
  it("estágio com 30 h passa; com 31 h é recusado", async () => {
    await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload({ type: VacancyType.INTERNSHIP, workHours: 30 }))
      .expect(201);

    const res = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload({ type: VacancyType.INTERNSHIP, workHours: 31 }))
      .expect(400);

    // A mensagem diz a unidade: "máximo 30 h" sozinho confundiria quem não
    // sabe se o limite é semanal ou diário.
    expect(res.body.message).toMatch(/30 h semanais/);
  });

  it("jovem aprendiz com 6 h diárias passa; com 7 h é recusado", async () => {
    await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload({ type: VacancyType.APPRENTICE, workHours: 6 }))
      .expect(201);

    const res = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload({ type: VacancyType.APPRENTICE, workHours: 7 }))
      .expect(400);

    // Recusado por 7 > 6 DIÁRIAS, e não por uma conversão para semanais —
    // é assim que a CLT art. 432 escreve o limite.
    expect(res.body.message).toMatch(/6 h diárias/);
  });

  it("emprego aceita 44 h semanais e recusa 44,5 h", async () => {
    await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload({ type: VacancyType.EMPLOYMENT, workHours: 44 }))
      .expect(201);

    await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload({ type: VacancyType.EMPLOYMENT, workHours: 44.5 }))
      .expect(400);
  });

  it("o limite vale sobre o estado RESULTANTE da edição", async () => {
    // Emprego com 44 h é válido; virar estágio sem mexer nas horas não é.
    const vaga = await createVacancy(
      ctx.dataSource,
      advertiserId,
      responsibleId,
      { type: VacancyType.EMPLOYMENT, workHours: 44 },
    );

    const res = await ctx.request
      .patch(`${VACANCIES}/${vaga.id}`)
      .set(authHeader(responsibleJwt))
      .send({ type: VacancyType.INTERNSHIP })
      .expect(400);

    expect(res.body.message).toMatch(/30 h semanais/);
  });
});

describe("RN-VG3 — prazo de candidatura", () => {
  it("prazo no futuro, dentro dos 60 dias, é aceito no envio", async () => {
    const criada = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload({ deadline: daysFromNow(30) }))
      .expect(201);

    await ctx.request
      .post(`${VACANCIES}/${criada.body.data.id}/submit`)
      .set(authHeader(responsibleJwt))
      .send({ confirmed: true })
      .expect(200);
  });

  it("prazo anterior à publicação é recusado", async () => {
    const vaga = await createVacancy(
      ctx.dataSource,
      advertiserId,
      responsibleId,
      { deadline: new Date(Date.now() - 60_000) },
    );

    const res = await ctx.request
      .post(`${VACANCIES}/${vaga.id}/submit`)
      .set(authHeader(responsibleJwt))
      .send({ confirmed: true })
      .expect(400);

    expect(res.body.message).toMatch(/anterior à publicação/i);
  });

  it("prazo além dos 60 dias de validade é recusado", async () => {
    const vaga = await createVacancy(
      ctx.dataSource,
      advertiserId,
      responsibleId,
      { deadline: new Date(daysFromNow(61)) },
    );

    const res = await ctx.request
      .post(`${VACANCIES}/${vaga.id}/submit`)
      .set(authHeader(responsibleJwt))
      .send({ confirmed: true })
      .expect(400);

    expect(res.body.message).toMatch(/60 dias/);
  });

  it("um rascunho antigo tem o prazo revalidado no envio, não na criação", async () => {
    // O prazo era válido quando a vaga foi montada; o rascunho ficou
    // parado e a data passou. Validar só na criação deixaria publicar uma
    // vaga com prazo vencido.
    const vaga = await createVacancy(
      ctx.dataSource,
      advertiserId,
      responsibleId,
      { deadline: new Date(Date.now() - 1_000) },
    );

    await ctx.request
      .post(`${VACANCIES}/${vaga.id}/submit`)
      .set(authHeader(responsibleJwt))
      .send({ confirmed: true })
      .expect(400);
  });
});

describe("RN-VG9 — a vaga não define faixa de idade", () => {
  it("aceita a marca 'exige 18 anos ou mais'", async () => {
    const res = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload({ requiresAdult: true }))
      .expect(201);

    expect(res.body.data.requiresAdult).toBe(true);
  });

  it("recusa qualquer campo de faixa de idade", async () => {
    // Anúncio com limite de idade é prática discriminatória (Lei
    // 9.029/1995). O `.strict()` recusa o corpo em vez de ignorar o campo
    // em silêncio — ignorar faria o front achar que o filtro funciona.
    for (const campo of [
      { minAge: 18 },
      { maxAge: 24 },
      { ageRange: "18-24" },
    ]) {
      await ctx.request
        .post(VACANCIES)
        .set(authHeader(responsibleJwt))
        .send(vacancyPayload(campo))
        .expect(400);
    }
  });
});

describe("RF29 — dupla confirmação", () => {
  it("envio sem confirmação explícita é recusado", async () => {
    const vaga = await createVacancy(
      ctx.dataSource,
      advertiserId,
      responsibleId,
    );

    // Sem este campo um POST acidental publicaria a vaga. É a dupla
    // confirmação escrita como regra do sistema, não como tela.
    await ctx.request
      .post(`${VACANCIES}/${vaga.id}/submit`)
      .set(authHeader(responsibleJwt))
      .send({})
      .expect(400);

    await ctx.request
      .post(`${VACANCIES}/${vaga.id}/submit`)
      .set(authHeader(responsibleJwt))
      .send({ confirmed: false })
      .expect(400);
  });
});
