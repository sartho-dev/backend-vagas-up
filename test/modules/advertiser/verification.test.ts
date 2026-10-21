// POR QUE EXISTE: o selo de verificação é o que separa quem pode publicar
// vaga paga e ver o banco de talentos (RN-V5) de quem não pode. Um selo
// concedido por engano ou sem rastro quebra a confiança do candidato — por
// isso cada decisão guarda autor, data e método (RNF07), a recusa exige
// motivo, e o método precisa bater com o tipo do anunciante (RN-V2/V3).
// Nenhuma imagem de documento é guardada em lugar nenhum (RN-V3).
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
import { Advertiser } from "@/modules/advertiser/schema/Advertiser.schema";
import {
  AdvertiserType,
  VerificationMethod,
  VerificationStatus,
} from "@/modules/advertiser/types/AdvertiserEnums";

let ctx: TestContext;
// Quase todo teste daqui precisa de um admin logado; criar na mão em cada um
// só adicionava ruído.
let adminJwt: string;

const CNPJ = "11222333000181";
const OTHER_CNPJ = "11444777000161";
const CPF = "39053344705";

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  ctx.emailSender.reset();
  ctx.cnpjLookup.reset();
  adminJwt = await adminToken();
});

async function adminToken(): Promise<string> {
  const admin = await createAdmin(ctx.dataSource, ctx.hasher);
  const { token } = await loginAs(ctx, admin.email, DEFAULT_PASSWORD);
  return token;
}

async function advertiserWithResponsible(
  overrides: Parameters<typeof createAdvertiser>[2] = {},
) {
  const { advertiser, responsible } = await createAdvertiser(
    ctx.dataSource,
    ctx.hasher,
    overrides,
  );
  const { token } = await loginAs(ctx, responsible.email, DEFAULT_PASSWORD);
  return { advertiser, responsible, token };
}

function reload(id: string): Promise<Advertiser | null> {
  return ctx.dataSource.getRepository(Advertiser).findOne({ where: { id } });
}

describe("RF21 — o responsável pede a verificação", () => {
  it("entra na fila e carimba a hora do pedido", async () => {
    const { advertiser, token } = await advertiserWithResponsible();

    await ctx.request
      .post("/api/v1/advertisers/me/verification")
      .set(authHeader(token))
      .expect(204);

    const saved = await reload(advertiser.id);
    expect(saved!.verification).toBe(VerificationStatus.PENDING);
    expect(saved!.verificationRequestedAt).not.toBeNull();
  });

  it("pedir duas vezes é recusado: a fila não ganha entrada duplicada", async () => {
    const { token } = await advertiserWithResponsible();

    await ctx.request
      .post("/api/v1/advertisers/me/verification")
      .set(authHeader(token))
      .expect(204);

    const res = await ctx.request
      .post("/api/v1/advertisers/me/verification")
      .set(authHeader(token))
      .expect(409);

    expect(res.body.message).toMatch(/em análise/i);
  });

  it("anunciante já verificado não pede de novo", async () => {
    const { token } = await advertiserWithResponsible({
      verification: VerificationStatus.VERIFIED,
    });

    const res = await ctx.request
      .post("/api/v1/advertisers/me/verification")
      .set(authHeader(token))
      .expect(409);

    expect(res.body.message).toMatch(/já está verificado/i);
  });

  it("recusado pode pedir nova verificação, e a recusa anterior é limpa", async () => {
    const { advertiser, token } = await advertiserWithResponsible({
      verification: VerificationStatus.REJECTED,
    });
    await ctx.dataSource
      .getRepository(Advertiser)
      .update(
        { id: advertiser.id },
        { rejectionReason: "Razão social não bate" },
      );

    await ctx.request
      .post("/api/v1/advertisers/me/verification")
      .set(authHeader(token))
      .expect(204);

    const saved = await reload(advertiser.id);
    expect(saved!.verification).toBe(VerificationStatus.PENDING);
    expect(saved!.rejectionReason).toBeNull();
    expect(saved!.verificationRequestedAt).not.toBeNull();
  });

  it("sem token: 401", async () => {
    await ctx.request.post("/api/v1/advertisers/me/verification").expect(401);
  });

  it("token de outro perfil: 403", async () => {
    const student = await createStudent(ctx.dataSource, ctx.hasher);
    const { token } = await loginAs(ctx, student.email, DEFAULT_PASSWORD);

    await ctx.request
      .post("/api/v1/advertisers/me/verification")
      .set(authHeader(token))
      .expect(403);
  });
});

describe("RF30 — fila de verificação no painel do admin", () => {
  const QUEUE = "/api/v1/admin/advertisers/verification-queue";

  it("lista só quem pediu, do pedido mais antigo para o mais novo", async () => {
    const older = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
      displayName: "Pediu primeiro",
      verificationRequestedAt: new Date("2026-10-01T12:00:00Z"),
    });
    const newer = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: OTHER_CNPJ,
      displayName: "Pediu depois",
      verificationRequestedAt: new Date("2026-10-10T12:00:00Z"),
    });
    // Pendente que nunca pediu: não entra, senão a fila encheria de
    // anunciantes recém-cadastrados que não pediram nada.
    await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: "19131243000197",
      displayName: "Nem pediu",
    });

    const res = await ctx.request
      .get(QUEUE)
      .set(authHeader(adminJwt))
      .expect(200);

    expect(res.body.data.total).toBe(2);
    expect(res.body.data.items.map((i: { id: string }) => i.id)).toEqual([
      older.advertiser.id,
      newer.advertiser.id,
    ]);
  });

  it("verificado e recusado não aparecem na fila", async () => {
    await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
      verification: VerificationStatus.VERIFIED,
      verificationRequestedAt: new Date("2026-10-01T12:00:00Z"),
    });
    await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: OTHER_CNPJ,
      verification: VerificationStatus.REJECTED,
      verificationRequestedAt: new Date("2026-10-02T12:00:00Z"),
    });

    const res = await ctx.request
      .get(QUEUE)
      .set(authHeader(adminJwt))
      .expect(200);

    expect(res.body.data.total).toBe(0);
  });

  it("pagina", async () => {
    await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
      verificationRequestedAt: new Date("2026-10-01T12:00:00Z"),
    });
    await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: OTHER_CNPJ,
      verificationRequestedAt: new Date("2026-10-02T12:00:00Z"),
    });

    const res = await ctx.request
      .get(`${QUEUE}?page=2&limit=1`)
      .set(authHeader(adminJwt))
      .expect(200);

    expect(res.body.data.total).toBe(2);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.page).toBe(2);
  });

  it("o detalhe traz os responsáveis para o admin conferir o vínculo", async () => {
    const { advertiser, responsible } = await createAdvertiser(
      ctx.dataSource,
      ctx.hasher,
      { document: CNPJ, verificationRequestedAt: new Date() },
    );

    const res = await ctx.request
      .get(`/api/v1/admin/advertisers/${advertiser.id}`)
      .set(authHeader(adminJwt))
      .expect(200);

    expect(res.body.data.document).toBe(CNPJ);
    expect(res.body.data.responsibles).toHaveLength(1);
    expect(res.body.data.responsibles[0].email).toBe(responsible.email);
    // O CPF do responsável nunca sai, e senha nenhuma vaza.
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    expect(res.body.data.responsibles[0]).not.toHaveProperty("cpf");
  });

  it("id que não é UUID é recusado antes do banco (400, não 500)", async () => {
    await ctx.request
      .get("/api/v1/admin/advertisers/nao-e-uuid")
      .set(authHeader(adminJwt))
      .expect(400);
  });

  it("anunciante inexistente: 404", async () => {
    await ctx.request
      .get("/api/v1/admin/advertisers/00000000-0000-4000-8000-000000000000")
      .set(authHeader(adminJwt))
      .expect(404);
  });

  it("sem token: 401; token de responsável: 403; admin: 200", async () => {
    const { token } = await advertiserWithResponsible();

    await ctx.request.get(QUEUE).expect(401);
    await ctx.request.get(QUEUE).set(authHeader(token)).expect(403);
    await ctx.request.get(QUEUE).set(authHeader(adminJwt)).expect(200);
  });
});

describe("RN-V2 — consulta pública do CNPJ como apoio à decisão", () => {
  it("aponta situação ativa, razão social igual e domínio do responsável", async () => {
    const { advertiser, responsible } = await createAdvertiser(
      ctx.dataSource,
      ctx.hasher,
      {
        document: CNPJ,
        legalName: "Padaria do Zé LTDA",
        email: "jose@padariadoze.com.br",
      },
    );
    ctx.cnpjLookup.set(CNPJ, {
      legalName: "PADARIA DO ZE LTDA.",
      isActive: true,
      emailDomains: [
        { domain: "padariadoze.com.br", ownership: "CORPORATE" },
        { domain: "contabilidade.com.br", ownership: "ACCOUNTING" },
      ],
    });

    const res = await ctx.request
      .get(`/api/v1/admin/advertisers/${advertiser.id}/cnpj-lookup`)
      .set(authHeader(adminJwt))
      .expect(200);

    expect(ctx.cnpjLookup.asked).toEqual([CNPJ]);
    expect(res.body.data.found).toBe(true);
    expect(res.body.data.status.isActive).toBe(true);
    // Pontuação e acento não deveriam reprovar uma razão social correta.
    expect(res.body.data.legalNameMatches).toBe(true);
    expect(res.body.data.responsibles).toEqual([
      {
        id: responsible.id,
        name: responsible.name,
        emailDomain: "padariadoze.com.br",
        matchesCorporateDomain: true,
      },
    ]);
  });

  it("razão social diferente é sinalizada, não aprovada", async () => {
    const { advertiser } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
      legalName: "Financeira Zé LTDA",
    });
    ctx.cnpjLookup.set(CNPJ, { legalName: "PADARIA DO ZE LTDA" });

    const res = await ctx.request
      .get(`/api/v1/admin/advertisers/${advertiser.id}/cnpj-lookup`)
      .set(authHeader(adminJwt))
      .expect(200);

    expect(res.body.data.legalNameMatches).toBe(false);
  });

  it("CNPJ fora da base devolve found: false, não erro", async () => {
    const { advertiser } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
    });

    const res = await ctx.request
      .get(`/api/v1/admin/advertisers/${advertiser.id}/cnpj-lookup`)
      .set(authHeader(adminJwt))
      .expect(200);

    expect(res.body.data.found).toBe(false);
  });

  it("PF não tem consulta pública (RN-V3): 400", async () => {
    const { advertiser } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      type: AdvertiserType.INDIVIDUAL,
      document: CPF,
      legalName: null,
    });

    const res = await ctx.request
      .get(`/api/v1/admin/advertisers/${advertiser.id}/cnpj-lookup`)
      .set(authHeader(adminJwt))
      .expect(400);

    expect(res.body.message).toMatch(/pessoa jurídica/i);
  });

  it("sem token: 401; token de responsável: 403", async () => {
    const { advertiser, token } = await advertiserWithResponsible({
      document: CNPJ,
    });
    const url = `/api/v1/admin/advertisers/${advertiser.id}/cnpj-lookup`;

    await ctx.request.get(url).expect(401);
    await ctx.request.get(url).set(authHeader(token)).expect(403);
  });
});

describe("RF30 / RNF07 — decisão registrada com autor, data e método", () => {
  const decide = (id: string) =>
    ctx.request.patch(`/api/v1/admin/advertisers/${id}/verification`);

  it("verifica PJ pelo domínio corporativo e grava quem, quando e como", async () => {
    const admin = await createAdmin(ctx.dataSource, ctx.hasher);
    const { token } = await loginAs(ctx, admin.email, DEFAULT_PASSWORD);
    const { advertiser } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
      verificationRequestedAt: new Date(),
    });

    await decide(advertiser.id)
      .set(authHeader(token))
      .send({
        decision: "verify",
        method: VerificationMethod.CNPJ_LOOKUP_EMAIL_DOMAIN,
      })
      .expect(204);

    const saved = await reload(advertiser.id);
    expect(saved!.verification).toBe(VerificationStatus.VERIFIED);
    expect(saved!.verifiedBy).toBe(admin.id);
    expect(saved!.verifiedAt).not.toBeNull();
    expect(saved!.verificationMethod).toBe(
      VerificationMethod.CNPJ_LOOKUP_EMAIL_DOMAIN,
    );
    expect(saved!.rejectionReason).toBeNull();
  });

  it("recusa guarda o motivo e o autor", async () => {
    const admin = await createAdmin(ctx.dataSource, ctx.hasher);
    const { token } = await loginAs(ctx, admin.email, DEFAULT_PASSWORD);
    const { advertiser } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
      verificationRequestedAt: new Date(),
    });

    await decide(advertiser.id)
      .set(authHeader(token))
      .send({
        decision: "reject",
        reason: "Razão social não bate com a Receita",
      })
      .expect(204);

    const saved = await reload(advertiser.id);
    expect(saved!.verification).toBe(VerificationStatus.REJECTED);
    expect(saved!.rejectionReason).toBe("Razão social não bate com a Receita");
    expect(saved!.verifiedBy).toBe(admin.id);
    expect(saved!.verifiedAt).not.toBeNull();
    // Recusa não é método de verificação: o método fica vazio.
    expect(saved!.verificationMethod).toBeNull();
  });

  it("recusa sem motivo é recusada", async () => {
    const { advertiser } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
      verificationRequestedAt: new Date(),
    });

    const res = await decide(advertiser.id)
      .set(authHeader(adminJwt))
      .send({ decision: "reject" })
      .expect(400);

    expect(JSON.stringify(res.body)).toMatch(/motivo/i);

    const saved = await reload(advertiser.id);
    expect(saved!.verification).toBe(VerificationStatus.PENDING);
  });

  it("motivo em branco também é recusado", async () => {
    const { advertiser } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
      verificationRequestedAt: new Date(),
    });

    await decide(advertiser.id)
      .set(authHeader(adminJwt))
      .send({ decision: "reject", reason: "   " })
      .expect(400);
  });

  it("verificar sem método é recusado", async () => {
    const { advertiser } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
      verificationRequestedAt: new Date(),
    });

    await decide(advertiser.id)
      .set(authHeader(adminJwt))
      .send({ decision: "verify" })
      .expect(400);
  });

  it("PJ não é verificada por videochamada (RN-V2)", async () => {
    const { advertiser } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
      verificationRequestedAt: new Date(),
    });

    const res = await decide(advertiser.id)
      .set(authHeader(adminJwt))
      .send({ decision: "verify", method: VerificationMethod.VIDEO_CALL })
      .expect(400);

    expect(res.body.message).toMatch(/pessoa jurídica/i);

    const saved = await reload(advertiser.id);
    expect(saved!.verification).toBe(VerificationStatus.PENDING);
  });

  it("PF é verificada por videochamada, e não pela consulta de CNPJ (RN-V3)", async () => {
    const admin = await createAdmin(ctx.dataSource, ctx.hasher);
    const { token } = await loginAs(ctx, admin.email, DEFAULT_PASSWORD);
    const { advertiser } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      type: AdvertiserType.INDIVIDUAL,
      document: CPF,
      legalName: null,
      verificationRequestedAt: new Date(),
    });

    await decide(advertiser.id)
      .set(authHeader(token))
      .send({
        decision: "verify",
        method: VerificationMethod.CNPJ_LOOKUP_PHONE_CALL,
      })
      .expect(400);

    await decide(advertiser.id)
      .set(authHeader(token))
      .send({ decision: "verify", method: VerificationMethod.VIDEO_CALL })
      .expect(204);

    const saved = await reload(advertiser.id);
    expect(saved!.verificationMethod).toBe(VerificationMethod.VIDEO_CALL);
  });

  it("método inventado é recusado pelo Zod", async () => {
    const { advertiser } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
      verificationRequestedAt: new Date(),
    });

    await decide(advertiser.id)
      .set(authHeader(adminJwt))
      .send({ decision: "verify", method: "olhei_e_achei_ok" })
      .expect(400);
  });

  it("decisão com motivo E método junto é recusada: o registro não fica ambíguo", async () => {
    const { advertiser } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
      verificationRequestedAt: new Date(),
    });

    await decide(advertiser.id)
      .set(authHeader(adminJwt))
      .send({
        decision: "verify",
        method: VerificationMethod.CNPJ_LOOKUP_PHONE_CALL,
        reason: "motivo órfão",
      })
      .expect(400);
  });

  it("segundo admin não sobrescreve a decisão do primeiro: 409", async () => {
    const first = await createAdmin(ctx.dataSource, ctx.hasher);
    const second = await createAdmin(ctx.dataSource, ctx.hasher);
    const firstToken = (await loginAs(ctx, first.email, DEFAULT_PASSWORD))
      .token;
    const secondToken = (await loginAs(ctx, second.email, DEFAULT_PASSWORD))
      .token;
    const { advertiser } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
      verificationRequestedAt: new Date(),
    });

    await decide(advertiser.id)
      .set(authHeader(firstToken))
      .send({
        decision: "verify",
        method: VerificationMethod.CNPJ_LOOKUP_PHONE_CALL,
      })
      .expect(204);

    const res = await decide(advertiser.id)
      .set(authHeader(secondToken))
      .send({ decision: "reject", reason: "não concordo" })
      .expect(409);

    expect(res.body.message).toMatch(/já está verificado/i);

    const saved = await reload(advertiser.id);
    expect(saved!.verifiedBy).toBe(first.id);
    expect(saved!.verification).toBe(VerificationStatus.VERIFIED);
  });

  it("recusado espera novo pedido do responsável antes de outra decisão: 409", async () => {
    const { advertiser } = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: CNPJ,
      verification: VerificationStatus.REJECTED,
    });

    const res = await decide(advertiser.id)
      .set(authHeader(adminJwt))
      .send({
        decision: "verify",
        method: VerificationMethod.CNPJ_LOOKUP_PHONE_CALL,
      })
      .expect(409);

    expect(res.body.message).toMatch(/recusado/i);
  });

  it("anunciante inexistente: 404", async () => {
    await decide("00000000-0000-4000-8000-000000000000")
      .set(authHeader(adminJwt))
      .send({ decision: "verify", method: VerificationMethod.VIDEO_CALL })
      .expect(404);
  });

  it("sem token: 401; token de responsável: 403", async () => {
    const { advertiser, token } = await advertiserWithResponsible({
      document: CNPJ,
      verificationRequestedAt: new Date(),
    });
    const body = {
      decision: "verify",
      method: VerificationMethod.CNPJ_LOOKUP_PHONE_CALL,
    };

    await decide(advertiser.id).send(body).expect(401);
    await decide(advertiser.id).set(authHeader(token)).send(body).expect(403);
  });
});

describe("RF23 × verificação — trocar o nome devolve para a fila", () => {
  it("verificado que muda a razão social volta a pendente e reentra na fila", async () => {
    const { advertiser, token } = await advertiserWithResponsible({
      document: CNPJ,
      verification: VerificationStatus.VERIFIED,
    });
    const admin = await createAdmin(ctx.dataSource, ctx.hasher);
    await ctx.dataSource.getRepository(Advertiser).update(
      { id: advertiser.id },
      {
        verifiedBy: admin.id,
        verifiedAt: new Date(),
        verificationMethod: VerificationMethod.CNPJ_LOOKUP_EMAIL_DOMAIN,
      },
    );

    await ctx.request
      .patch("/api/v1/advertisers/me")
      .set(authHeader(token))
      .send({ legalName: "Financeira do Zé LTDA" })
      .expect(200);

    const saved = await reload(advertiser.id);
    expect(saved!.verification).toBe(VerificationStatus.PENDING);
    expect(saved!.verifiedBy).toBeNull();
    expect(saved!.verificationMethod).toBeNull();

    const queue = await ctx.request
      .get("/api/v1/admin/advertisers/verification-queue")
      .set(authHeader(adminJwt))
      .expect(200);

    expect(queue.body.data.items.map((i: { id: string }) => i.id)).toContain(
      advertiser.id,
    );
  });
});
