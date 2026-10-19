// POR QUE EXISTE: o curso é referenciado por formações (RF11) e por vagas
// (RF24). Deixar excluir um curso em uso quebraria esses vínculos, e aceitar
// nome duplicado criaria dois "Administração" que dividiriam os candidatos
// no mural e nos filtros de busca.
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

let ctx: TestContext;
let adminToken: string;

const ADMIN_EMAIL = "adm@test.local";
const STUDENT_EMAIL = "cand@test.local";

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  await createAdmin(ctx.dataSource, ctx.hasher, { email: ADMIN_EMAIL });
  adminToken = (await loginAs(ctx, ADMIN_EMAIL, DEFAULT_PASSWORD)).token;
});

const createCourse = (name: string, token = adminToken) =>
  ctx.request
    .post("/api/v1/admin/courses")
    .set(authHeader(token))
    .send({ name });

describe("RF33 — cadastro de cursos", () => {
  it("o administrador cadastra", async () => {
    const res = await createCourse("Administração").expect(201);

    expect(res.body.data.name).toBe("Administração");
    expect(res.body.data.id).toBeTruthy();
  });

  it("recusa nome duplicado com 409", async () => {
    await createCourse("Administração").expect(201);

    await createCourse("Administração").expect(409);
  });

  it("o nome é aparado antes de comparar", async () => {
    await createCourse("Administração").expect(201);

    // Sem o trim, "  Administração  " entraria como um segundo curso e a
    // constraint não pegaria — dois cursos iguais aos olhos de quem usa.
    await createCourse("  Administração  ").expect(409);
  });

  it("recusa nome curto demais", async () => {
    await createCourse("A").expect(400);
  });

  it("renomeia", async () => {
    const created = await createCourse("Administracao").expect(201);

    const res = await ctx.request
      .patch(`/api/v1/admin/courses/${created.body.data.id}`)
      .set(authHeader(adminToken))
      .send({ name: "Administração" })
      .expect(200);

    expect(res.body.data.name).toBe("Administração");
  });

  it("renomear para um nome que já existe dá 409", async () => {
    await createCourse("Administração").expect(201);
    const other = await createCourse("Direito").expect(201);

    await ctx.request
      .patch(`/api/v1/admin/courses/${other.body.data.id}`)
      .set(authHeader(adminToken))
      .send({ name: "Administração" })
      .expect(409);
  });

  it("id malformado dá 400, não 500", async () => {
    await ctx.request
      .patch("/api/v1/admin/courses/nao-e-uuid")
      .set(authHeader(adminToken))
      .send({ name: "Qualquer" })
      .expect(400);
  });
});

describe("RF33 — exclusão", () => {
  it("curso sem vínculo é excluído", async () => {
    const created = await createCourse("Direito").expect(201);

    await ctx.request
      .delete(`/api/v1/admin/courses/${created.body.data.id}`)
      .set(authHeader(adminToken))
      .expect(204);

    const list = await ctx.request.get("/api/v1/courses").expect(200);
    expect(list.body.data).toHaveLength(0);
  });

  it("curso inexistente dá 404", async () => {
    await ctx.request
      .delete("/api/v1/admin/courses/11111111-1111-4111-8111-111111111111")
      .set(authHeader(adminToken))
      .expect(404);
  });
});

describe("Leitura é pública", () => {
  it("visitante sem token lê a lista", async () => {
    await createCourse("Administração").expect(201);

    const res = await ctx.request.get("/api/v1/courses").expect(200);

    expect(res.body.data).toHaveLength(1);
  });

  it("candidato lê a lista", async () => {
    await createCourse("Administração").expect(201);
    await createStudent(ctx.dataSource, ctx.hasher, { email: STUDENT_EMAIL });
    const { token } = await loginAs(ctx, STUDENT_EMAIL, DEFAULT_PASSWORD);

    await ctx.request
      .get("/api/v1/courses")
      .set(authHeader(token))
      .expect(200);
  });

  it("vem em ordem alfabética", async () => {
    await createCourse("Direito").expect(201);
    await createCourse("Administração").expect(201);

    const res = await ctx.request.get("/api/v1/courses").expect(200);

    expect(res.body.data.map((c: { name: string }) => c.name)).toEqual([
      "Administração",
      "Direito",
    ]);
  });
});

describe("Escrita é só do administrador", () => {
  it("sem token: 401", async () => {
    await ctx.request
      .post("/api/v1/admin/courses")
      .send({ name: "Administração" })
      .expect(401);
  });

  it("token de candidato: 403", async () => {
    await createStudent(ctx.dataSource, ctx.hasher, { email: STUDENT_EMAIL });
    const { token } = await loginAs(ctx, STUDENT_EMAIL, DEFAULT_PASSWORD);

    await createCourse("Administração", token).expect(403);
  });
});
