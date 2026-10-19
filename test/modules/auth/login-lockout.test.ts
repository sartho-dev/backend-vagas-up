// POR QUE EXISTE: RN-A4 bloqueia o login por 15 min após 5 falhas seguidas.
// Sem isso, uma senha fraca cai em força bruta. E o bloqueio não pode se
// denunciar: a resposta tem de ser idêntica à de senha errada (RN-A1), senão
// vira um oráculo que confirma quais e-mails existem.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestContext, TestContext } from "../../utils/app";
import { truncateAll } from "../../setup/truncate";
import { createAdmin, DEFAULT_PASSWORD } from "../../utils/fixtures";
import { config } from "@/shared/config";

let ctx: TestContext;

const EMAIL = "lock@test.local";
const WRONG = "SenhaErrada999";

function login(email: string, password: string) {
  return ctx.request.post("/api/v1/auth/login").send({ email, password });
}

async function failNTimes(n: number) {
  for (let i = 0; i < n; i += 1) {
    await login(EMAIL, WRONG);
  }
}

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  await createAdmin(ctx.dataSource, ctx.hasher, { email: EMAIL });
});

describe("RN-A4 — bloqueio após 5 falhas seguidas", () => {
  it("recusa a senha correta depois de atingir o limite", async () => {
    await failNTimes(config.loginMaxAttempts);

    const res = await login(EMAIL, DEFAULT_PASSWORD);

    expect(res.status).toBe(401);
  });

  it("deixa entrar com a senha correta antes do limite", async () => {
    await failNTimes(config.loginMaxAttempts - 1);

    const res = await login(EMAIL, DEFAULT_PASSWORD);

    expect(res.status).toBe(200);
  });

  it("login bem-sucedido zera o contador", async () => {
    await failNTimes(config.loginMaxAttempts - 1);
    await login(EMAIL, DEFAULT_PASSWORD);

    // Se o contador não tivesse zerado, esta falha isolada bloquearia.
    await failNTimes(1);

    const res = await login(EMAIL, DEFAULT_PASSWORD);
    expect(res.status).toBe(200);
  });

  it("a resposta do bloqueio é idêntica à de senha errada", async () => {
    const wrongPasswordBody = (await login(EMAIL, WRONG)).body;

    await failNTimes(config.loginMaxAttempts);

    const blocked = await login(EMAIL, DEFAULT_PASSWORD);

    expect(blocked.status).toBe(401);
    expect(blocked.body).toEqual(wrongPasswordBody);
    expect(blocked.body).toEqual({
      status: "error",
      message: "E-mail ou senha inválidos",
    });
  });

  it("o bloqueio termina depois do prazo", async () => {
    await failNTimes(config.loginMaxAttempts);
    expect((await login(EMAIL, DEFAULT_PASSWORD)).status).toBe(401);

    // Em vez de esperar 15 minutos, envelhece o bloqueio no banco.
    await ctx.dataSource.query(
      `UPDATE admins SET blocked_until = now() - interval '1 second' WHERE email = $1`,
      [EMAIL],
    );

    const res = await login(EMAIL, DEFAULT_PASSWORD);
    expect(res.status).toBe(200);
  });
});
