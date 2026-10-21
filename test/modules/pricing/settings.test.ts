// POR QUE EXISTE: a tabela de configuração é o que o administrador muda sem
// deploy — o link da comunidade de anunciantes (RF41) e o contato de
// "Anuncie aqui" (RF40). Dois riscos: chave inventada virando lixo no banco,
// e link sem validação virando `javascript:` na tela de quem confia no site.
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
  DEFAULT_PASSWORD,
} from "../../utils/fixtures";
import { SettingKey } from "@/modules/pricing/types/PricingEnums";
import { Setting } from "@/modules/pricing/schema/Setting.schema";

let ctx: TestContext;
let adminJwt: string;
let adminId: string;

const SETTINGS = "/api/v1/admin/settings";
const COMMUNITY = `${SETTINGS}/${SettingKey.ADVERTISER_COMMUNITY_URL}`;
const CONTACT = `${SETTINGS}/${SettingKey.SPONSORSHIP_CONTACT}`;

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  const admin = await createAdmin(ctx.dataSource, ctx.hasher);
  adminId = admin.id;
  adminJwt = (await loginAs(ctx, admin.email, DEFAULT_PASSWORD)).token;
});

describe("Configurações do sistema", () => {
  it("lista todas as chaves conhecidas, mesmo sem nenhuma configurada", async () => {
    const res = await ctx.request
      .get(SETTINGS)
      .set(authHeader(adminJwt))
      .expect(200);

    // Chave sem valor aparece com null: é assim que o painel sabe que o
    // campo existe para ser preenchido.
    expect(res.body.data).toEqual([
      {
        key: SettingKey.ADVERTISER_COMMUNITY_URL,
        value: null,
        updatedBy: null,
        updatedAt: null,
      },
      {
        key: SettingKey.SPONSORSHIP_CONTACT,
        value: null,
        updatedBy: null,
        updatedAt: null,
      },
      // RF28: entrou na task 14, para a tela de pagamento da vaga.
      {
        key: SettingKey.PIX_KEY,
        value: null,
        updatedBy: null,
        updatedAt: null,
      },
    ]);
  });

  it("configura o link da comunidade e guarda quem alterou (RNF07)", async () => {
    const res = await ctx.request
      .patch(COMMUNITY)
      .set(authHeader(adminJwt))
      .send({ value: "https://chat.whatsapp.com/ABC123" })
      .expect(200);

    expect(res.body.data.value).toBe("https://chat.whatsapp.com/ABC123");
    expect(res.body.data.updatedBy).toBe(adminId);

    const saved = await ctx.dataSource
      .getRepository(Setting)
      .findOne({ where: { key: SettingKey.ADVERTISER_COMMUNITY_URL } });
    expect(saved!.value).toBe("https://chat.whatsapp.com/ABC123");
    expect(saved!.updatedBy).toBe(adminId);
  });

  it("alterar de novo substitui, não duplica: a chave é a PK", async () => {
    await ctx.request
      .patch(COMMUNITY)
      .set(authHeader(adminJwt))
      .send({ value: "https://chat.whatsapp.com/PRIMEIRO" })
      .expect(200);

    await ctx.request
      .patch(COMMUNITY)
      .set(authHeader(adminJwt))
      .send({ value: "https://chat.whatsapp.com/SEGUNDO" })
      .expect(200);

    const all = await ctx.dataSource.getRepository(Setting).find();
    expect(all).toHaveLength(1);
    expect(all[0].value).toBe("https://chat.whatsapp.com/SEGUNDO");
  });

  it("`value: null` apaga a configuração, que volta a não configurada", async () => {
    await ctx.request
      .patch(COMMUNITY)
      .set(authHeader(adminJwt))
      .send({ value: "https://chat.whatsapp.com/ABC123" })
      .expect(200);

    const res = await ctx.request
      .patch(COMMUNITY)
      .set(authHeader(adminJwt))
      .send({ value: null })
      .expect(200);

    expect(res.body.data.value).toBeNull();
    expect(await ctx.dataSource.getRepository(Setting).find()).toHaveLength(0);

    // E quem consome vê "não configurada", não string vazia — a RF41
    // simplesmente não mostra o convite.
    await expect(
      ctx.container.settingService.valueOfService(
        SettingKey.ADVERTISER_COMMUNITY_URL,
      ),
    ).resolves.toBeNull();
  });

  it("link sem https é recusado", async () => {
    const res = await ctx.request
      .patch(COMMUNITY)
      .set(authHeader(adminJwt))
      .send({ value: "javascript:alert(1)" })
      .expect(400);

    expect(JSON.stringify(res.body)).toMatch(/https/i);
    expect(await ctx.dataSource.getRepository(Setting).find()).toHaveLength(0);
  });

  it("http simples também é recusado", async () => {
    await ctx.request
      .patch(COMMUNITY)
      .set(authHeader(adminJwt))
      .send({ value: "http://chat.whatsapp.com/ABC123" })
      .expect(400);
  });

  it("o contato de 'Anuncie aqui' é texto livre, mas não vazio", async () => {
    await ctx.request
      .patch(CONTACT)
      .set(authHeader(adminJwt))
      .send({ value: "contato@estagiaaqui.com.br" })
      .expect(200);

    await ctx.request
      .patch(CONTACT)
      .set(authHeader(adminJwt))
      .send({ value: "   " })
      .expect(400);
  });

  it("chave inventada: 400, não uma linha nova no banco", async () => {
    const res = await ctx.request
      .patch(`${SETTINGS}/cor_do_botao`)
      .set(authHeader(adminJwt))
      .send({ value: "azul" })
      .expect(400);

    expect(JSON.stringify(res.body)).toMatch(/chave/i);
    expect(await ctx.dataSource.getRepository(Setting).find()).toHaveLength(0);
  });

  it("recusa campo desconhecido no corpo", async () => {
    await ctx.request
      .patch(CONTACT)
      .set(authHeader(adminJwt))
      .send({ value: "contato@estagiaaqui.com.br", key: "outra" })
      .expect(400);
  });

  it("sem token: 401; responsável: 403", async () => {
    const { responsible } = await createAdvertiser(ctx.dataSource, ctx.hasher);
    const responsibleJwt = (
      await loginAs(ctx, responsible.email, DEFAULT_PASSWORD)
    ).token;

    await ctx.request.get(SETTINGS).expect(401);
    await ctx.request.get(SETTINGS).set(authHeader(responsibleJwt)).expect(403);
    await ctx.request
      .patch(CONTACT)
      .set(authHeader(responsibleJwt))
      .send({ value: "x" })
      .expect(403);
  });
});
