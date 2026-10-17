// POR QUE EXISTE: a recuperação de senha é a porta dos fundos de qualquer
// sistema — se ela vazar quais e-mails existem, ou aceitar um link duas
// vezes, ou deixar a sessão antiga viva depois da troca, ela vira o caminho
// mais fácil para tomar uma conta.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createTestContext,
  TestContext,
  loginAs,
  authHeader,
} from "../../utils/app";
import { truncateAll } from "../../setup/truncate";
import { createStudent, DEFAULT_PASSWORD } from "../../utils/fixtures";
import { config } from "@/shared/config";

let ctx: TestContext;

const EMAIL = "recupera@test.local";
const NEW_PASSWORD = "SenhaNovaForte123";

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  ctx.emailSender.reset();
  await createStudent(ctx.dataSource, ctx.hasher, { email: EMAIL });
});

const request = (email: string) =>
  ctx.request.post("/api/v1/auth/password-recovery").send({ email });

const confirm = (token: string, newPassword = NEW_PASSWORD) =>
  ctx.request
    .post("/api/v1/auth/password-recovery/confirm")
    .send({ token, newPassword });

// O link só existe no e-mail: é assim que o fluxo é testado de ponta a ponta.
function tokenFromLastEmail(): string {
  const body = ctx.emailSender.last?.body ?? "";
  const match = body.match(/token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error(`Nenhum token no e-mail: ${body}`);
  return match[1];
}

describe("RN-A6 — o pedido não revela se o e-mail existe", () => {
  it("responde igual para e-mail cadastrado e inexistente", async () => {
    const known = await request(EMAIL);
    const unknown = await request("naoexiste@test.local");

    expect(known.status).toBe(204);
    expect(unknown.status).toBe(204);
    expect(known.body).toEqual(unknown.body);
  });

  it("responde igual para conta desativada", async () => {
    await createStudent(ctx.dataSource, ctx.hasher, {
      email: "inativa@test.local",
      cpf: "52998224725",
      active: false,
    });

    const inactive = await request("inativa@test.local");
    const unknown = await request("naoexiste@test.local");

    expect(inactive.status).toBe(unknown.status);
    expect(inactive.body).toEqual(unknown.body);
  });

  it("só envia e-mail quando a conta existe e está ativa", async () => {
    await request("naoexiste@test.local");
    expect(ctx.emailSender.sent).toHaveLength(0);

    await request(EMAIL);
    expect(ctx.emailSender.sent).toHaveLength(1);
    expect(ctx.emailSender.last?.to).toBe(EMAIL);
  });
});

describe("Redefinição da senha", () => {
  it("troca a senha e permite entrar com a nova", async () => {
    await request(EMAIL);

    await confirm(tokenFromLastEmail()).expect(204);

    await ctx.request
      .post("/api/v1/auth/login")
      .send({ email: EMAIL, password: NEW_PASSWORD })
      .expect(200);
  });

  it("a senha antiga deixa de valer", async () => {
    await request(EMAIL);
    await confirm(tokenFromLastEmail()).expect(204);

    await ctx.request
      .post("/api/v1/auth/login")
      .send({ email: EMAIL, password: DEFAULT_PASSWORD })
      .expect(401);
  });

  it("RN-A3: as sessões abertas caem", async () => {
    const { token: session } = await loginAs(ctx, EMAIL, DEFAULT_PASSWORD);

    await request(EMAIL);
    await confirm(tokenFromLastEmail()).expect(204);

    await ctx.request
      .get("/api/v1/students/me")
      .set(authHeader(session))
      .expect(401);
  });

  it("aplica a RN-A5 à senha nova", async () => {
    await request(EMAIL);

    await confirm(tokenFromLastEmail(), "curta").expect(400);
  });
});

describe("O link é de uso único e expira", () => {
  it("o segundo uso falha", async () => {
    await request(EMAIL);
    const token = tokenFromLastEmail();

    await confirm(token).expect(204);
    await confirm(token, "OutraSenhaForte123").expect(400);
  });

  it("um pedido novo invalida o link anterior", async () => {
    await request(EMAIL);
    const first = tokenFromLastEmail();

    await request(EMAIL);
    const second = tokenFromLastEmail();

    await confirm(first).expect(400);
    await confirm(second).expect(204);
  });

  it("token inexistente falha igual a token usado", async () => {
    await request(EMAIL);
    const token = tokenFromLastEmail();
    await confirm(token).expect(204);

    const used = await confirm(token, "OutraSenhaForte123");
    const nonsense = await confirm(
      "token-que-nunca-existiu-mas-tem-tamanho",
      "OutraSenhaForte123",
    );

    expect(used.status).toBe(nonsense.status);
    expect(used.body).toEqual(nonsense.body);
  });

  it("o e-mail avisa a validade do link", async () => {
    await request(EMAIL);

    const minutes = config.recoveryTokenTtlMs / 60_000;
    expect(ctx.emailSender.last?.body).toContain(`${minutes} minutos`);
  });
});
