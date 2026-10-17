// POR QUE EXISTE: três garantias que o RF02/RF03 fazem e que, se quebrarem,
// quebram em silêncio — token de outro perfil alcançando o service do
// candidato, senha trocada sem derrubar sessão, e CPF do próprio dono.
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

const STUDENT_EMAIL = "cand@test.local";
const ADMIN_EMAIL = "adm@test.local";
const CPF = "39053344705";

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  await createStudent(ctx.dataSource, ctx.hasher, {
    email: STUDENT_EMAIL,
    cpf: CPF,
  });
  await createAdmin(ctx.dataSource, ctx.hasher, { email: ADMIN_EMAIL });
});

// O token tem de ser resolvido ANTES de montar a requisição. Escrever
// `.set(authHeader(await token()))` cria o objeto do supertest primeiro e
// só então aguarda — e o servidor efêmero dele cai nesse intervalo
// ("Cannot read properties of null (reading 'address')").
const studentToken = () =>
  loginAs(ctx, STUDENT_EMAIL, DEFAULT_PASSWORD).then((r) => r.token);
const adminToken = () =>
  loginAs(ctx, ADMIN_EMAIL, DEFAULT_PASSWORD).then((r) => r.token);

describe("GET /students/me — perfil próprio", () => {
  it("devolve o CPF completo ao dono (Anexo A)", async () => {
    const token = await studentToken();

    const res = await ctx.request
      .get("/api/v1/students/me")
      .set(authHeader(token))
      .expect(200);

    expect(res.body.data.cpf).toBe(CPF);
    expect(res.body.data.email).toBe(STUDENT_EMAIL);
  });

  it("nunca devolve o hash da senha", async () => {
    const token = await studentToken();

    const res = await ctx.request
      .get("/api/v1/students/me")
      .set(authHeader(token))
      .expect(200);

    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    expect(JSON.stringify(res.body)).not.toContain("$2b$");
  });

  it("sem token: 401", async () => {
    await ctx.request.get("/api/v1/students/me").expect(401);
  });

  it("token de admin: 403 (RF02)", async () => {
    const token = await adminToken();

    await ctx.request
      .get("/api/v1/students/me")
      .set(authHeader(token))
      .expect(403);
  });
});

describe("PATCH /students/me — edição do próprio perfil", () => {
  it("token de admin: 403 (RF02)", async () => {
    const token = await adminToken();

    await ctx.request
      .patch("/api/v1/students/me")
      .set(authHeader(token))
      .send({ city: "Dourados" })
      .expect(403);
  });

  it("o candidato edita a própria cidade", async () => {
    const token = await studentToken();

    const res = await ctx.request
      .patch("/api/v1/students/me")
      .set(authHeader(token))
      .send({ city: "Dourados" })
      .expect(200);

    expect(res.body.data.city).toBe("Dourados");
  });

  it("não aceita troca de e-mail: é a task 07 (RF03)", async () => {
    const token = await studentToken();

    await ctx.request
      .patch("/api/v1/students/me")
      .set(authHeader(token))
      .send({ email: "outro@test.local" })
      .expect(400);
  });
});

describe("PATCH /students/me/password — RN-A5 e RN-A3", () => {
  const NEW_PASSWORD = "NovaSenhaForte123";

  function changePassword(token: string, body: Record<string, unknown>) {
    return ctx.request
      .patch("/api/v1/students/me/password")
      .set(authHeader(token))
      .send(body);
  }

  it("troca a senha e permite entrar com a nova", async () => {
    await changePassword(await studentToken(), {
      currentPassword: DEFAULT_PASSWORD,
      newPassword: NEW_PASSWORD,
    }).expect(204);

    await ctx.request
      .post("/api/v1/auth/login")
      .send({ email: STUDENT_EMAIL, password: NEW_PASSWORD })
      .expect(200);
  });

  it("senha atual errada responde 400, não 401", async () => {
    const res = await changePassword(await studentToken(), {
      currentPassword: "SenhaErrada999",
      newPassword: NEW_PASSWORD,
    });

    // 401 faria o cliente achar que a sessão expirou e mandar o usuário
    // fazer login de novo, em vez de corrigir a senha digitada.
    expect(res.status).toBe(400);
  });

  it("RN-A3: o token usado na própria troca deixa de funcionar", async () => {
    const token = await studentToken();

    await changePassword(token, {
      currentPassword: DEFAULT_PASSWORD,
      newPassword: NEW_PASSWORD,
    }).expect(204);

    await ctx.request
      .get("/api/v1/students/me")
      .set(authHeader(token))
      .expect(401);
  });

  it("recusa nova senha igual à atual", async () => {
    await changePassword(await studentToken(), {
      currentPassword: DEFAULT_PASSWORD,
      newPassword: DEFAULT_PASSWORD,
    }).expect(400);
  });

  it("token de admin: 403 (RF02)", async () => {
    await changePassword(await adminToken(), {
      currentPassword: DEFAULT_PASSWORD,
      newPassword: NEW_PASSWORD,
    }).expect(403);
  });
});
