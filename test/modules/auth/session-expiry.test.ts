// POR QUE EXISTE: RN-A3 define dois limites independentes — 30 min sem uso e
// 8 h desde o login. O segundo é o que garante que uma sessão usada sem parar
// termine algum dia; sem ele, um token roubado e mantido ativo nunca expira.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createTestContext,
  TestContext,
  loginAs,
  authHeader,
} from "../../utils/app";
import { truncateAll } from "../../setup/truncate";
import { createAdmin, DEFAULT_PASSWORD } from "../../utils/fixtures";
import { config } from "@/shared/config";

let ctx: TestContext;
const EMAIL = "sess@test.local";

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  await createAdmin(ctx.dataSource, ctx.hasher, { email: EMAIL });
});

// Envelhece a sessão no banco em vez de esperar o relógio.
async function ageSession(column: string, interval: string) {
  await ctx.dataSource.query(
    `UPDATE sessions SET ${column} = now() - interval '${interval}'`,
  );
}

function listAdmins(token: string) {
  return ctx.request
    .get("/api/v1/admin/administrators")
    .set(authHeader(token));
}

describe("RN-A3 — expiração da sessão", () => {
  it("os limites configurados são 30 min de ociosidade e 8 h de idade", () => {
    expect(config.sessionIdleMs).toBe(30 * 60 * 1000);
    expect(config.sessionMaxAgeMs).toBe(8 * 60 * 60 * 1000);
  });

  it("aceita a sessão dentro dos dois limites", async () => {
    const { token } = await loginAs(ctx, EMAIL, DEFAULT_PASSWORD);

    expect((await listAdmins(token)).status).toBe(200);
  });

  it("recusa a sessão ociosa há mais de 30 min", async () => {
    const { token } = await loginAs(ctx, EMAIL, DEFAULT_PASSWORD);

    await ageSession("last_used_at", "31 minutes");

    expect((await listAdmins(token)).status).toBe(401);
  });

  it("recusa a sessão com mais de 8 h, mesmo em uso contínuo", async () => {
    const { token } = await loginAs(ctx, EMAIL, DEFAULT_PASSWORD);

    // last_used_at segue agora: a sessão está em uso. Só a idade estourou.
    await ageSession("created_at", "8 hours 1 minute");

    expect((await listAdmins(token)).status).toBe(401);
  });

  it("sair encerra a sessão imediatamente", async () => {
    const { token } = await loginAs(ctx, EMAIL, DEFAULT_PASSWORD);

    await ctx.request
      .post("/api/v1/auth/logout")
      .set(authHeader(token))
      .expect(204);

    expect((await listAdmins(token)).status).toBe(401);
  });
});
