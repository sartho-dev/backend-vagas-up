// POR QUE EXISTE: RN23 exige resposta idêntica para e-mail inexistente, senha
// errada e conta desativada. Se um desses casos responder diferente, um
// atacante descobre quem está cadastrado.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestContext, TestContext } from "../../utils/app";
import { truncateAll } from "../../setup/truncate";
import { createAdmin, DEFAULT_PASSWORD } from "../../utils/fixtures";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
});

describe("RN23 — login não revela se um e-mail está cadastrado", () => {
  it("responde igual para existente/inativa/inexistente", async () => {
    await createAdmin(ctx.dataSource, ctx.hasher, {
      email: "ativo@test.local",
      active: true,
    });
    await createAdmin(ctx.dataSource, ctx.hasher, {
      email: "inativa@test.local",
      active: false,
    });

    const cases = [
      { email: "ativo@test.local", password: "SenhaErrada999" },
      { email: "inativa@test.local", password: DEFAULT_PASSWORD },
      { email: "naoexiste@test.local", password: DEFAULT_PASSWORD },
    ];

    const responses = await Promise.all(
      cases.map((body) => ctx.request.post("/api/v1/auth/login").send(body)),
    );

    for (const res of responses) {
      expect(res.status).toBe(401);
    }

    for (const res of responses) {
      expect(res.body).toEqual({
        status: "error",
        message: "E-mail ou senha inválidos",
      });
    }
  });
});
