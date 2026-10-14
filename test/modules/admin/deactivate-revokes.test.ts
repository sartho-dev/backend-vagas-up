// POR QUE EXISTE: RN21 diz que desativar uma conta encerra TODAS as sessões
// dela. Sem `revokeAllSessions`, o admin desativado continuaria acessando
// até o idle timeout — o que na prática significa até 30 minutos de acesso
// indevido. Esse teste trava a garantia.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createTestContext,
  TestContext,
  loginAs,
  authHeader,
} from "../../utils/app";
import { truncateAll } from "../../setup/truncate";
import { createAdmin, DEFAULT_PASSWORD } from "../../utils/fixtures";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
});

describe("RN21 — desativar revoga as sessões do alvo", () => {
  it("derruba a sessão do admin desativado imediatamente", async () => {
    const actor = await createAdmin(ctx.dataSource, ctx.hasher, {
      email: "actor@test.local",
    });
    const target = await createAdmin(ctx.dataSource, ctx.hasher, {
      email: "target@test.local",
    });

    const actorAuth = await loginAs(ctx, "actor@test.local", DEFAULT_PASSWORD);
    const targetAuth = await loginAs(
      ctx,
      "target@test.local",
      DEFAULT_PASSWORD,
    );

    await ctx.request
      .patch(`/api/v1/admin/administrators/${target.id}/deactivate`)
      .set(authHeader(actorAuth.token))
      .expect(200);

    await ctx.request
      .get("/api/v1/admin/administrators")
      .set(authHeader(targetAuth.token))
      .expect(401);
  });
});
