// POR QUE EXISTE: o RF03 exige confirmação pelo NOVO endereço porque, sem
// ela, quem encontrasse um navegador logado trocaria o e-mail e tomaria a
// conta — e o dono perderia até o caminho de recuperação. O caso da corrida
// (alguém registrar o endereço entre o pedido e a confirmação) é o que faz
// a checagem ter de acontecer duas vezes.
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

const EMAIL = "dono@test.local";
const NEW_EMAIL = "novo@test.local";

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  ctx.emailSender.reset();
  await createStudent(ctx.dataSource, ctx.hasher, { email: EMAIL });
});

async function session() {
  const { token } = await loginAs(ctx, EMAIL, DEFAULT_PASSWORD);
  return token;
}

function requestChange(token: string, newEmail = NEW_EMAIL) {
  return ctx.request
    .post("/api/v1/auth/email-change")
    .set(authHeader(token))
    .send({ newEmail });
}

const confirmChange = (token: string) =>
  ctx.request.post("/api/v1/auth/email-change/confirm").send({ token });

function tokenFromLastEmail(): string {
  const body = ctx.emailSender.last?.body ?? "";
  const match = body.match(/token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error(`Nenhum token no e-mail: ${body}`);
  return match[1];
}

describe("RF03 — pedido de troca de e-mail", () => {
  it("exige sessão", async () => {
    await ctx.request
      .post("/api/v1/auth/email-change")
      .send({ newEmail: NEW_EMAIL })
      .expect(401);
  });

  it("o link vai para o endereço NOVO, nunca para o atual", async () => {
    await requestChange(await session()).expect(204);

    expect(ctx.emailSender.sent).toHaveLength(1);
    expect(ctx.emailSender.last?.to).toBe(NEW_EMAIL);
    expect(ctx.emailSender.last?.to).not.toBe(EMAIL);
  });

  it("o e-mail da conta NÃO muda antes da confirmação", async () => {
    const token = await session();
    await requestChange(token).expect(204);

    const profile = await ctx.request
      .get("/api/v1/students/me")
      .set(authHeader(token))
      .expect(200);

    expect(profile.body.data.email).toBe(EMAIL);
  });

  it("recusa endereço que já pertence a outra conta", async () => {
    await createAdmin(ctx.dataSource, ctx.hasher, { email: "ocupado@test.local" });

    await requestChange(await session(), "ocupado@test.local").expect(409);
  });
});

describe("RF03 — confirmação", () => {
  it("troca o e-mail e permite entrar com ele", async () => {
    await requestChange(await session()).expect(204);

    await confirmChange(tokenFromLastEmail()).expect(204);

    await ctx.request
      .post("/api/v1/auth/login")
      .send({ email: NEW_EMAIL, password: DEFAULT_PASSWORD })
      .expect(200);
  });

  it("o e-mail antigo deixa de entrar", async () => {
    await requestChange(await session()).expect(204);
    await confirmChange(tokenFromLastEmail()).expect(204);

    await ctx.request
      .post("/api/v1/auth/login")
      .send({ email: EMAIL, password: DEFAULT_PASSWORD })
      .expect(401);
  });

  it("encerra as sessões: trocar e-mail é mudar credencial", async () => {
    const token = await session();
    await requestChange(token).expect(204);
    await confirmChange(tokenFromLastEmail()).expect(204);

    await ctx.request
      .get("/api/v1/students/me")
      .set(authHeader(token))
      .expect(401);
  });

  it("é de uso único", async () => {
    await requestChange(await session()).expect(204);
    const link = tokenFromLastEmail();

    await confirmChange(link).expect(204);
    await confirmChange(link).expect(400);
  });

  it("RN-A7: recusa se o endereço for tomado ENTRE o pedido e a confirmação", async () => {
    await requestChange(await session()).expect(204);
    const link = tokenFromLastEmail();

    // Alguém registra o endereço nesse intervalo. Confiar só na checagem do
    // pedido deixaria duas contas com o mesmo e-mail.
    await createAdmin(ctx.dataSource, ctx.hasher, { email: NEW_EMAIL });

    await confirmChange(link).expect(409);
  });

  it("depois de um 409 por corrida, o e-mail da conta continua o antigo", async () => {
    const token = await session();
    await requestChange(token).expect(204);
    const link = tokenFromLastEmail();

    await createAdmin(ctx.dataSource, ctx.hasher, { email: NEW_EMAIL });
    await confirmChange(link).expect(409);

    await ctx.request
      .post("/api/v1/auth/login")
      .send({ email: EMAIL, password: DEFAULT_PASSWORD })
      .expect(200);
  });
});
