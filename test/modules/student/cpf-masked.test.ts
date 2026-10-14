// POR QUE EXISTE: RN32 manda mascarar o CPF em qualquer listagem do admin.
// Não é feature, é conformidade — um CPF completo vazando numa tela de
// listagem pode virar problema com a LGPD. O teste confere que o CPF cru
// não aparece nem no item nem no corpo inteiro da resposta.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestContext, TestContext, loginAs, authHeader } from "../../utils/app";
import { truncateAll } from "../../setup/truncate";
import { createAdmin, createStudent, DEFAULT_PASSWORD } from "../../utils/fixtures";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
});

describe("RN32 — CPF mascarado na listagem do admin", () => {
  it("nunca devolve o CPF completo", async () => {
    await createStudent(ctx.dataSource, ctx.hasher, {
      cpf: "39053344705",
      email: "s1@test.local",
    });
    await createAdmin(ctx.dataSource, ctx.hasher, { email: "a@test.local" });
    const { token } = await loginAs(ctx, "a@test.local", DEFAULT_PASSWORD);

    const res = await ctx.request
      .get("/api/v1/admin/students")
      .set(authHeader(token))
      .expect(200);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].cpf).toBe("•••.533.447-••");
    expect(JSON.stringify(res.body)).not.toContain("39053344705");
  });
});
