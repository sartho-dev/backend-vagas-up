// POR QUE EXISTE: a RN-VG8 diz que o anunciante sempre tem ao menos um
// responsável ativo. Sem a trava, dois responsáveis se desativando ao mesmo
// tempo deixariam a empresa sem ninguém — e as vagas dela sem dono, com
// candidaturas em andamento. É a mesma corrida do último admin (RF34).
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
  createStudent,
  DEFAULT_PASSWORD,
} from "../../utils/fixtures";
import { AppDataSource } from "@/shared/database/data-source";
import { Responsible } from "@/modules/advertiser/schema/Responsible.schema";
import { AdvertiserRepository } from "@/modules/advertiser/repository/AdvertiserRepository";
import { Advertiser } from "@/modules/advertiser/schema/Advertiser.schema";

let ctx: TestContext;
let token: string;
let advertiserId: string;
let ownerId: string;

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  ctx.emailSender.reset();

  const created = await createAdvertiser(ctx.dataSource, ctx.hasher, {
    email: "dono@test.local",
  });
  advertiserId = created.advertiser.id;
  ownerId = created.responsible.id;
  token = (await loginAs(ctx, "dono@test.local", DEFAULT_PASSWORD)).token;
});

const invite = (email: string, as = token) =>
  ctx.request
    .post("/api/v1/advertisers/me/responsibles/invite")
    .set(authHeader(as))
    .send({ email });

function tokenFromLastEmail(): string {
  const body = ctx.emailSender.last?.body ?? "";
  const match = body.match(/token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error(`Nenhum token no e-mail: ${body}`);
  return match[1];
}

const accept = (inviteToken: string, name = "Convidado") =>
  ctx.request
    .post("/api/v1/advertisers/invites/accept")
    .send({ token: inviteToken, name, password: "SenhaForte123" });

describe("RF22 — convite de responsável", () => {
  it("envia o convite ao endereço informado", async () => {
    await invite("novo@test.local").expect(204);

    expect(ctx.emailSender.last?.to).toBe("novo@test.local");
    expect(ctx.emailSender.last?.subject).toContain("Padaria Teste");
  });

  it("o convidado define a própria senha e entra", async () => {
    await invite("novo@test.local").expect(204);

    await accept(tokenFromLastEmail()).expect(201);

    const res = await ctx.request
      .post("/api/v1/auth/login")
      .send({ email: "novo@test.local", password: "SenhaForte123" })
      .expect(200);

    expect(res.body.data.role).toBe("responsible");
  });

  it("o convidado entra no MESMO anunciante de quem convidou", async () => {
    await invite("novo@test.local").expect(204);
    await accept(tokenFromLastEmail()).expect(201);

    const guest = await loginAs(ctx, "novo@test.local", "SenhaForte123");
    const res = await ctx.request
      .get("/api/v1/advertisers/me")
      .set(authHeader(guest.token))
      .expect(200);

    expect(res.body.data.id).toBe(advertiserId);
  });

  it("o convite é de uso único", async () => {
    await invite("novo@test.local").expect(204);
    const link = tokenFromLastEmail();

    await accept(link).expect(201);
    await accept(link, "Outro").expect(400);
  });

  it("recusa convidar e-mail já cadastrado", async () => {
    await createStudent(ctx.dataSource, ctx.hasher, {
      email: "ocupado@test.local",
    });

    await invite("ocupado@test.local").expect(409);
  });

  it("RN-A7: e-mail tomado ENTRE o convite e o aceite é recusado", async () => {
    await invite("corrida@test.local").expect(204);
    const link = tokenFromLastEmail();

    await createStudent(ctx.dataSource, ctx.hasher, {
      email: "corrida@test.local",
      cpf: "52998224725",
    });

    await accept(link).expect(409);
  });

  it("token inventado é recusado", async () => {
    await accept("token-que-nunca-existiu-mas-tem-tamanho").expect(400);
  });
});

describe("RN-VG8 — sempre ao menos um responsável ativo", () => {
  async function addSecondResponsible(): Promise<string> {
    await invite("segundo@test.local").expect(204);
    const res = await accept(tokenFromLastEmail(), "Segundo").expect(201);

    return res.body.data.id as string;
  }

  it("não dá para desativar o único responsável", async () => {
    await invite("nao-usado@test.local").expect(204);

    const res = await ctx.request
      .patch(`/api/v1/advertisers/me/responsibles/${ownerId}/deactivate`)
      .set(authHeader(token));

    // É a própria conta: barrado antes mesmo da regra do último ativo.
    expect(res.status).toBe(409);
  });

  it("com dois responsáveis, desativar um funciona", async () => {
    const secondId = await addSecondResponsible();

    await ctx.request
      .patch(`/api/v1/advertisers/me/responsibles/${secondId}/deactivate`)
      .set(authHeader(token))
      .expect(204);

    const list = await ctx.request
      .get("/api/v1/advertisers/me/responsibles")
      .set(authHeader(token))
      .expect(200);

    expect(list.body.data.filter((r: { active: boolean }) => r.active)).toHaveLength(1);
  });

  it("desativar o último ativo é recusado", async () => {
    const secondId = await addSecondResponsible();

    // O segundo desativa o dono; sobra só ele.
    const second = await loginAs(ctx, "segundo@test.local", "SenhaForte123");
    await ctx.request
      .patch(`/api/v1/advertisers/me/responsibles/${ownerId}/deactivate`)
      .set(authHeader(second.token))
      .expect(204);

    // Agora ninguém pode tirar o último — nem ele mesmo, nem o dono inativo.
    const outcome = await new AdvertiserRepository(
      AppDataSource.getRepository(Advertiser),
    ).deactivateResponsible(secondId, advertiserId);

    expect(outcome).toBe("last_active");
  });

  it("duas desativações concorrentes: uma passa, a outra vê o último ativo", async () => {
    const secondId = await addSecondResponsible();

    const repository = new AdvertiserRepository(
      AppDataSource.getRepository(Advertiser),
    );

    const outcomes = await Promise.all([
      repository.deactivateResponsible(ownerId, advertiserId),
      repository.deactivateResponsible(secondId, advertiserId),
    ]);

    expect(outcomes.sort()).toEqual(["deactivated", "last_active"]);

    const stillActive = await AppDataSource.getRepository(Responsible).count({
      where: { advertiserId, active: true },
    });
    expect(stillActive).toBe(1);
  });

  it("responsável de outro anunciante não é alcançado", async () => {
    const other = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      email: "outro@empresa.local",
      document: "11444777000161",
    });

    await ctx.request
      .patch(
        `/api/v1/advertisers/me/responsibles/${other.responsible.id}/deactivate`,
      )
      .set(authHeader(token))
      .expect(404);
  });
});
