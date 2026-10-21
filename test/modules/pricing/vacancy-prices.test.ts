// POR QUE EXISTE: o preço é o que o anunciante paga por PIX fora do site, e
// ninguém confere duas vezes um valor que já foi cobrado. A RN-P8 depende de
// uma coisa só: mudar o preço aqui não pode mexer em vaga nenhuma. Os três
// tipos têm exatamente uma linha cada (a PK é o tipo), e toda alteração
// guarda autor e data (RNF07).
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
  DEFAULT_PASSWORD,
} from "../../utils/fixtures";
import { VacancyType } from "@/shared/types/VacancyType";
import { VacancyPrice } from "@/modules/pricing/schema/VacancyPrice.schema";

let ctx: TestContext;
let adminJwt: string;
let adminId: string;

const PRICES = "/api/v1/admin/vacancy-prices";

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  const admin = await createAdmin(ctx.dataSource, ctx.hasher);
  adminId = admin.id;
  adminJwt = (await loginAs(ctx, admin.email, DEFAULT_PASSWORD)).token;
});

function reload(type: VacancyType): Promise<VacancyPrice | null> {
  return ctx.dataSource
    .getRepository(VacancyPrice)
    .findOne({ where: { type } });
}

describe("RF39 — tabela de preços", () => {
  it("nasce da migration com os preços decididos: 5, 10 e 5", async () => {
    const res = await ctx.request
      .get(PRICES)
      .set(authHeader(adminJwt))
      .expect(200);

    expect(res.body.data).toEqual([
      {
        type: VacancyType.INTERNSHIP,
        value: 5,
        updatedBy: null,
        updatedAt: expect.any(String),
      },
      {
        type: VacancyType.EMPLOYMENT,
        value: 10,
        updatedBy: null,
        updatedAt: expect.any(String),
      },
      {
        type: VacancyType.APPRENTICE,
        value: 5,
        updatedBy: null,
        updatedAt: expect.any(String),
      },
    ]);
  });

  it("os três tipos existem e nenhum repete: a PK é o tipo", async () => {
    const all = await ctx.dataSource.getRepository(VacancyPrice).find();

    expect(all).toHaveLength(3);
    expect(new Set(all.map((p) => p.type)).size).toBe(3);
  });

  it("o valor volta como número, não como string do driver", async () => {
    const res = await ctx.request
      .get(PRICES)
      .set(authHeader(adminJwt))
      .expect(200);

    for (const price of res.body.data) {
      expect(typeof price.value).toBe("number");
    }
  });
});

describe("RF39 / RNF07 — alteração registra autor e data", () => {
  it("altera o preço e guarda quem alterou", async () => {
    const before = new Date();

    const res = await ctx.request
      .patch(`${PRICES}/${VacancyType.EMPLOYMENT}`)
      .set(authHeader(adminJwt))
      .send({ value: 12.5 })
      .expect(200);

    expect(res.body.data.value).toBe(12.5);
    expect(res.body.data.updatedBy).toBe(adminId);

    const saved = await reload(VacancyType.EMPLOYMENT);
    expect(saved!.value).toBe(12.5);
    expect(saved!.updatedBy).toBe(adminId);
    expect(saved!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime() - 1000,
    );
  });

  it("alterar um tipo não mexe nos outros", async () => {
    await ctx.request
      .patch(`${PRICES}/${VacancyType.INTERNSHIP}`)
      .set(authHeader(adminJwt))
      .send({ value: 7 })
      .expect(200);

    expect((await reload(VacancyType.EMPLOYMENT))!.value).toBe(10);
    expect((await reload(VacancyType.APPRENTICE))!.value).toBe(5);
  });

  it("aceita zero: a P9 prevê lançar com preço R$ 0", async () => {
    await ctx.request
      .patch(`${PRICES}/${VacancyType.APPRENTICE}`)
      .set(authHeader(adminJwt))
      .send({ value: 0 })
      .expect(200);

    expect((await reload(VacancyType.APPRENTICE))!.value).toBe(0);
  });

  it("recusa valor negativo", async () => {
    const res = await ctx.request
      .patch(`${PRICES}/${VacancyType.EMPLOYMENT}`)
      .set(authHeader(adminJwt))
      .send({ value: -1 })
      .expect(400);

    expect(JSON.stringify(res.body)).toMatch(/negativo/i);
    expect((await reload(VacancyType.EMPLOYMENT))!.value).toBe(10);
  });

  it("recusa mais de duas casas decimais: não existe meio centavo no PIX", async () => {
    await ctx.request
      .patch(`${PRICES}/${VacancyType.EMPLOYMENT}`)
      .set(authHeader(adminJwt))
      .send({ value: 10.555 })
      .expect(400);

    expect((await reload(VacancyType.EMPLOYMENT))!.value).toBe(10);
  });

  it("recusa valor como texto", async () => {
    await ctx.request
      .patch(`${PRICES}/${VacancyType.EMPLOYMENT}`)
      .set(authHeader(adminJwt))
      .send({ value: "10" })
      .expect(400);
  });

  it("recusa campo desconhecido no corpo", async () => {
    await ctx.request
      .patch(`${PRICES}/${VacancyType.EMPLOYMENT}`)
      .set(authHeader(adminJwt))
      .send({ value: 11, type: "estagio" })
      .expect(400);
  });

  it("tipo de vaga inventado na rota: 400, não 500", async () => {
    const res = await ctx.request
      .patch(`${PRICES}/freelance`)
      .set(authHeader(adminJwt))
      .send({ value: 11 })
      .expect(400);

    expect(JSON.stringify(res.body)).toMatch(/tipo de vaga/i);
  });

  it("não há rota de criar nem de excluir preço", async () => {
    await ctx.request
      .post(PRICES)
      .set(authHeader(adminJwt))
      .send({ type: "freelance", value: 1 })
      .expect(404);

    await ctx.request
      .delete(`${PRICES}/${VacancyType.EMPLOYMENT}`)
      .set(authHeader(adminJwt))
      .expect(404);
  });
});

describe("RN-P8 — mudança de preço não volta atrás", () => {
  it("o valor lido para a vaga é o do momento da leitura, e a alteração seguinte não o altera", async () => {
    // É isto que a task 13 faz ao enviar a vaga para pagamento: lê o preço
    // uma vez e copia na linha da vaga. O valor copiado é um número solto,
    // não uma referência à tabela — por isso a alteração seguinte não o
    // alcança. A vaga em si (e o PIX) é a task 13/14; aqui prova-se a
    // metade que já existe.
    const copiedOnSubmit =
      await ctx.container.vacancyPriceService.priceOfService(
        VacancyType.EMPLOYMENT,
      );
    expect(copiedOnSubmit).toBe(10);

    await ctx.request
      .patch(`${PRICES}/${VacancyType.EMPLOYMENT}`)
      .set(authHeader(adminJwt))
      .send({ value: 99 })
      .expect(200);

    expect(copiedOnSubmit).toBe(10);
    // Quem enviar a vaga depois da alteração paga o novo valor.
    await expect(
      ctx.container.vacancyPriceService.priceOfService(VacancyType.EMPLOYMENT),
    ).resolves.toBe(99);
  });
});

describe("Acesso: preços são do administrador", () => {
  it("sem token: 401", async () => {
    await ctx.request.get(PRICES).expect(401);
    await ctx.request
      .patch(`${PRICES}/${VacancyType.EMPLOYMENT}`)
      .send({ value: 11 })
      .expect(401);
  });

  it("candidato e responsável: 403", async () => {
    const student = await createStudent(ctx.dataSource, ctx.hasher);
    const studentJwt = (await loginAs(ctx, student.email, DEFAULT_PASSWORD))
      .token;
    const { responsible } = await createAdvertiser(ctx.dataSource, ctx.hasher);
    const responsibleJwt = (
      await loginAs(ctx, responsible.email, DEFAULT_PASSWORD)
    ).token;

    await ctx.request.get(PRICES).set(authHeader(studentJwt)).expect(403);
    await ctx.request.get(PRICES).set(authHeader(responsibleJwt)).expect(403);
    await ctx.request
      .patch(`${PRICES}/${VacancyType.EMPLOYMENT}`)
      .set(authHeader(responsibleJwt))
      .send({ value: 1 })
      .expect(403);
  });
});
