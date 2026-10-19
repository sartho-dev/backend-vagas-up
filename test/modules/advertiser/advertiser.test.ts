// POR QUE EXISTE: o anunciante é o lado que paga e que pode fraudar. O
// documento único impede a mesma empresa de ter dois cadastros e burlar a
// vaga gratuita (RN-P1); a verificação que volta a pendente ao trocar de
// nome impede ser verificado como padaria e virar financeira (RF23); e a
// RN-VG8 impede o anunciante ficar sem ninguém que o administre.
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
import {
  AdvertiserType,
  VerificationStatus,
} from "@/modules/advertiser/types/AdvertiserEnums";

let ctx: TestContext;

const VALID_CNPJ = "11222333000181";
const VALID_CPF = "39053344705";

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  ctx.emailSender.reset();
});

function registerPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: AdvertiserType.COMPANY,
    document: VALID_CNPJ,
    displayName: "Padaria do Zé",
    legalName: "Padaria do Zé LTDA",
    contactEmail: "contato@padaria.local",
    contactPhone: "67999999999",
    site: null,
    firstResponsible: {
      name: "José Silva",
      email: "jose@padaria.local",
      password: "SenhaForte123",
    },
    ...overrides,
  };
}

const register = (body: Record<string, unknown>) =>
  ctx.request.post("/api/v1/advertisers").send(body);

describe("RF20 — cadastro de anunciante", () => {
  it("cadastra PJ com o primeiro responsável", async () => {
    const res = await register(registerPayload()).expect(201);

    expect(res.body.data.advertiser.document).toBe(VALID_CNPJ);
    expect(res.body.data.responsible.email).toBe("jose@padaria.local");
  });

  it("RN-V1: nasce pendente de verificação", async () => {
    const res = await register(registerPayload()).expect(201);

    expect(res.body.data.advertiser.verification).toBe(
      VerificationStatus.PENDING,
    );
  });

  it("cadastra PF com CPF", async () => {
    const res = await register(
      registerPayload({
        type: AdvertiserType.INDIVIDUAL,
        document: VALID_CPF,
        legalName: null,
      }),
    ).expect(201);

    expect(res.body.data.advertiser.type).toBe(AdvertiserType.INDIVIDUAL);
  });

  it("recusa CNPJ com dígito verificador inválido", async () => {
    await register(registerPayload({ document: "11222333000182" })).expect(400);
  });

  it("recusa CPF onde se espera CNPJ", async () => {
    // 11 dígitos num cadastro PJ: o cálculo do CNPJ não fecha.
    await register(registerPayload({ document: VALID_CPF })).expect(400);
  });

  it("recusa documento repetido", async () => {
    await register(registerPayload()).expect(201);

    await register(
      registerPayload({
        firstResponsible: {
          name: "Outro",
          email: "outro@padaria.local",
          password: "SenhaForte123",
        },
      }),
    ).expect(409);
  });

  it("RF20: PJ sem razão social é recusado", async () => {
    await register(registerPayload({ legalName: null })).expect(400);
  });

  it("RN-A7: e-mail já usado por um candidato é recusado", async () => {
    await createStudent(ctx.dataSource, ctx.hasher, {
      email: "jose@padaria.local",
    });

    await register(registerPayload()).expect(409);
  });

  it("o responsável criado consegue entrar", async () => {
    await register(registerPayload()).expect(201);

    const res = await ctx.request
      .post("/api/v1/auth/login")
      .send({ email: "jose@padaria.local", password: "SenhaForte123" })
      .expect(200);

    expect(res.body.data.role).toBe("responsible");
  });

  it("site precisa ser https", async () => {
    await register(registerPayload({ site: "http://padaria.local" })).expect(400);
  });
});

describe("RF23 — edição do anunciante", () => {
  async function verifiedAdvertiser() {
    const { responsible } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      email: "resp@test.local",
      verification: VerificationStatus.VERIFIED,
    });
    const { token } = await loginAs(ctx, "resp@test.local", DEFAULT_PASSWORD);

    return { responsible, token };
  }

  it("altera telefone sem perder a verificação", async () => {
    const { token } = await verifiedAdvertiser();

    const res = await ctx.request
      .patch("/api/v1/advertisers/me")
      .set(authHeader(token))
      .send({ contactPhone: "67988887777" })
      .expect(200);

    expect(res.body.data.verification).toBe(VerificationStatus.VERIFIED);
  });

  it("alterar o nome de exibição devolve para pendente", async () => {
    const { token } = await verifiedAdvertiser();

    const res = await ctx.request
      .patch("/api/v1/advertisers/me")
      .set(authHeader(token))
      .send({ displayName: "Financeira do Zé" })
      .expect(200);

    expect(res.body.data.verification).toBe(VerificationStatus.PENDING);
  });

  it("alterar a razão social também devolve para pendente", async () => {
    const { token } = await verifiedAdvertiser();

    const res = await ctx.request
      .patch("/api/v1/advertisers/me")
      .set(authHeader(token))
      .send({ legalName: "Outra Razão LTDA" })
      .expect(200);

    expect(res.body.data.verification).toBe(VerificationStatus.PENDING);
  });

  it("documento e tipo não são aceitos na edição", async () => {
    const { token } = await verifiedAdvertiser();

    await ctx.request
      .patch("/api/v1/advertisers/me")
      .set(authHeader(token))
      .send({ document: "11222333000181" })
      .expect(400);
  });
});

describe("Acesso: só o responsável, e só o próprio anunciante", () => {
  it("sem token: 401", async () => {
    await ctx.request.get("/api/v1/advertisers/me").expect(401);
  });

  it("token de candidato: 403", async () => {
    await createStudent(ctx.dataSource, ctx.hasher, { email: "c@test.local" });
    const { token } = await loginAs(ctx, "c@test.local", DEFAULT_PASSWORD);

    await ctx.request
      .get("/api/v1/advertisers/me")
      .set(authHeader(token))
      .expect(403);
  });

  it("token de admin: 403", async () => {
    await createAdmin(ctx.dataSource, ctx.hasher, { email: "a@test.local" });
    const { token } = await loginAs(ctx, "a@test.local", DEFAULT_PASSWORD);

    await ctx.request
      .get("/api/v1/advertisers/me")
      .set(authHeader(token))
      .expect(403);
  });

  it("o responsável só enxerga o próprio anunciante", async () => {
    await createAdvertiser(ctx.dataSource, ctx.hasher, {
      email: "a@um.local",
      displayName: "Empresa Um",
      document: "11222333000181",
    });
    await createAdvertiser(ctx.dataSource, ctx.hasher, {
      email: "b@dois.local",
      displayName: "Empresa Dois",
      document: "11444777000161",
    });

    const { token } = await loginAs(ctx, "b@dois.local", DEFAULT_PASSWORD);

    const res = await ctx.request
      .get("/api/v1/advertisers/me")
      .set(authHeader(token))
      .expect(200);

    expect(res.body.data.displayName).toBe("Empresa Dois");
  });
});
