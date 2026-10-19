// POR QUE EXISTE: RN19 (sessão única por conta). O AuthService já implementa
// via `replaceActiveSession`, mas é fácil quebrar numa refatoração e ninguém
// percebe até um token antigo continuar funcionando depois do usuário ter
// trocado de dispositivo por segurança.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestContext, TestContext, loginAs, authHeader } from "../../utils/app";
import { truncateAll } from "../../setup/truncate";
import { createAdmin, DEFAULT_PASSWORD } from "../../utils/fixtures";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
});

describe("RN19 — apenas uma sessão ativa por conta", () => {
  it("invalida o token anterior quando um novo login acontece", async () => {
    await createAdmin(ctx.dataSource, ctx.hasher, { email: "a@test.local" });

    const first = await loginAs(ctx, "a@test.local", DEFAULT_PASSWORD);
    const second = await loginAs(ctx, "a@test.local", DEFAULT_PASSWORD);

    await ctx.request
      .get("/api/v1/admin/administrators")
      .set(authHeader(first.token))
      .expect(401);

    await ctx.request
      .get("/api/v1/admin/administrators")
      .set(authHeader(second.token))
      .expect(200);
  });
});
