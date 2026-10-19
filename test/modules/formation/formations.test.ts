// POR QUE EXISTE: a formação é o que habilita a candidatura a estágio
// (RN-C4 exige uma EM ANDAMENTO) e o que prende o curso contra exclusão
// (RF33). As regras de data não são capricho: uma formação "em andamento"
// com data de fim no passado passaria a valer para o estágio sem
// corresponder à realidade.
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
  createStudent,
  DEFAULT_PASSWORD,
} from "../../utils/fixtures";
import { EducationLevel } from "@/modules/student/types/StudentEnums";
import { FormationStatus } from "@/modules/formation/types/FormationEnums";

let ctx: TestContext;
let token: string;
let courseId: string;

const EMAIL = "cand@test.local";
const ADMIN_EMAIL = "adm@test.local";

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();

  await createAdmin(ctx.dataSource, ctx.hasher, { email: ADMIN_EMAIL });
  const admin = await loginAs(ctx, ADMIN_EMAIL, DEFAULT_PASSWORD);
  const course = await ctx.request
    .post("/api/v1/admin/courses")
    .set(authHeader(admin.token))
    .send({ name: "Administração" })
    .expect(201);
  courseId = course.body.data.id;

  await createStudent(ctx.dataSource, ctx.hasher, { email: EMAIL });
  token = (await loginAs(ctx, EMAIL, DEFAULT_PASSWORD)).token;
});

function payload(overrides: Record<string, unknown> = {}) {
  return {
    level: EducationLevel.UNDERGRADUATE_IN_PROGRESS,
    courseId,
    institution: "UFMS",
    status: FormationStatus.IN_PROGRESS,
    startDate: "2024-02-01",
    endDate: null,
    ...overrides,
  };
}

const create = (body: Record<string, unknown>, as = token) =>
  ctx.request
    .post("/api/v1/students/me/formations")
    .set(authHeader(as))
    .send(body);

describe("RF11 — registro de formações", () => {
  it("zero formações é estado válido", async () => {
    const res = await ctx.request
      .get("/api/v1/students/me/formations")
      .set(authHeader(token))
      .expect(200);

    expect(res.body.data).toEqual([]);
  });

  it("cadastra com curso do catálogo", async () => {
    const res = await create(payload()).expect(201);

    expect(res.body.data.courseId).toBe(courseId);
    expect(res.body.data.courseName).toBe("Administração");
  });

  it("curso é opcional — ensino médio não tem curso do catálogo", async () => {
    const res = await create(
      payload({
        level: EducationLevel.HIGH_SCHOOL_COMPLETE,
        courseId: null,
        status: FormationStatus.COMPLETED,
        startDate: "2021-02-01",
        endDate: "2023-12-15",
      }),
    ).expect(201);

    expect(res.body.data.courseId).toBeNull();
    expect(res.body.data.courseName).toBeNull();
  });

  it("aceita várias formações", async () => {
    await create(payload()).expect(201);
    await create(
      payload({
        level: EducationLevel.HIGH_SCHOOL_COMPLETE,
        courseId: null,
        status: FormationStatus.COMPLETED,
        startDate: "2021-02-01",
        endDate: "2023-12-15",
      }),
    ).expect(201);

    const res = await ctx.request
      .get("/api/v1/students/me/formations")
      .set(authHeader(token))
      .expect(200);

    expect(res.body.data).toHaveLength(2);
  });

  it("curso inexistente dá 400, não 500", async () => {
    await create(
      payload({ courseId: "11111111-1111-4111-8111-111111111111" }),
    ).expect(400);
  });
});

describe("RF11 — regras de data", () => {
  it("recusa fim anterior ao início", async () => {
    await create(
      payload({
        status: FormationStatus.COMPLETED,
        startDate: "2024-02-01",
        endDate: "2023-12-15",
      }),
    ).expect(400);
  });

  it("aceita fim igual ao início", async () => {
    await create(
      payload({
        status: FormationStatus.COMPLETED,
        startDate: "2024-02-01",
        endDate: "2024-02-01",
      }),
    ).expect(201);
  });

  it("formação em andamento não pode ter data de fim", async () => {
    await create(
      payload({
        status: FormationStatus.IN_PROGRESS,
        endDate: "2025-12-01",
      }),
    ).expect(400);
  });

  it("na edição parcial, a regra olha o registro inteiro", async () => {
    // Concluída com data de fim; mudar só a situação para "em andamento"
    // deixaria a data de fim antiga para trás.
    const created = await create(
      payload({
        status: FormationStatus.COMPLETED,
        endDate: "2024-06-30",
      }),
    ).expect(201);

    await ctx.request
      .patch(`/api/v1/students/me/formations/${created.body.data.id}`)
      .set(authHeader(token))
      .send({ status: FormationStatus.IN_PROGRESS })
      .expect(400);
  });

  it("limpar o fim junto com a mudança para em andamento funciona", async () => {
    const created = await create(
      payload({ status: FormationStatus.COMPLETED, endDate: "2024-06-30" }),
    ).expect(201);

    const res = await ctx.request
      .patch(`/api/v1/students/me/formations/${created.body.data.id}`)
      .set(authHeader(token))
      .send({ status: FormationStatus.IN_PROGRESS, endDate: null })
      .expect(200);

    expect(res.body.data.endDate).toBeNull();
  });
});

describe("Posse: a formação é sempre do dono da sessão", () => {
  it("não alcança a formação de outro candidato", async () => {
    const mine = await create(payload()).expect(201);

    await createStudent(ctx.dataSource, ctx.hasher, {
      email: "outro@test.local",
      cpf: "52998224725",
    });
    const other = await loginAs(ctx, "outro@test.local", DEFAULT_PASSWORD);

    // 404 e não 403: dentro do escopo /me a formação alheia não existe.
    // Um 403 confirmaria que aquele id existe em algum lugar.
    await ctx.request
      .patch(`/api/v1/students/me/formations/${mine.body.data.id}`)
      .set(authHeader(other.token))
      .send({ institution: "Invadida" })
      .expect(404);

    await ctx.request
      .delete(`/api/v1/students/me/formations/${mine.body.data.id}`)
      .set(authHeader(other.token))
      .expect(404);
  });

  it("a listagem de outro candidato não mostra a minha", async () => {
    await create(payload()).expect(201);

    await createStudent(ctx.dataSource, ctx.hasher, {
      email: "outro@test.local",
      cpf: "52998224725",
    });
    const other = await loginAs(ctx, "outro@test.local", DEFAULT_PASSWORD);

    const res = await ctx.request
      .get("/api/v1/students/me/formations")
      .set(authHeader(other.token))
      .expect(200);

    expect(res.body.data).toEqual([]);
  });

  it("sem token: 401", async () => {
    await ctx.request.get("/api/v1/students/me/formations").expect(401);
  });

  it("token de admin: 403", async () => {
    const admin = await loginAs(ctx, ADMIN_EMAIL, DEFAULT_PASSWORD);

    await ctx.request
      .get("/api/v1/students/me/formations")
      .set(authHeader(admin.token))
      .expect(403);
  });
});

describe("Exclusão", () => {
  it("o dono exclui a própria formação", async () => {
    const created = await create(payload()).expect(201);

    await ctx.request
      .delete(`/api/v1/students/me/formations/${created.body.data.id}`)
      .set(authHeader(token))
      .expect(204);

    const res = await ctx.request
      .get("/api/v1/students/me/formations")
      .set(authHeader(token))
      .expect(200);
    expect(res.body.data).toEqual([]);
  });

  it("formação inexistente dá 404", async () => {
    await ctx.request
      .delete(
        "/api/v1/students/me/formations/11111111-1111-4111-8111-111111111111",
      )
      .set(authHeader(token))
      .expect(404);
  });
});
