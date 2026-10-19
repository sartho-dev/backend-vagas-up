// POR QUE EXISTE: o Anexo A da v4.9 define quem vê CPF — candidato vê o
// próprio, administrador vê todos, anunciante NUNCA. Este teste trava a
// metade que já existe (o administrador). A trava do anunciante entra na
// task 18, junto com o banco de talentos; o helper `maskCpf` já está pronto
// esperando por ela.
//
// Até 17/10/2026 este arquivo afirmava o contrário — que o admin via o CPF
// mascarado — seguindo a RN32 da v3.2. A v4.9 inverteu a regra (decisão D3).
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
import { maskCpf } from "@/shared/utils/maskCpf";

let ctx: TestContext;
const CPF = "39053344705";

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
});

describe("Anexo A — visibilidade do CPF", () => {
  it("o administrador vê o CPF completo na listagem", async () => {
    await createStudent(ctx.dataSource, ctx.hasher, {
      cpf: CPF,
      email: "s1@test.local",
    });
    await createAdmin(ctx.dataSource, ctx.hasher, { email: "a@test.local" });
    const { token } = await loginAs(ctx, "a@test.local", DEFAULT_PASSWORD);

    const res = await ctx.request
      .get("/api/v1/admin/students")
      .set(authHeader(token))
      .expect(200);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].cpf).toBe(CPF);
  });

  it("a listagem exige token de administrador", async () => {
    await expect(
      ctx.request.get("/api/v1/admin/students").expect(401),
    ).resolves.toBeTruthy();
  });
});

// A máscara continua sendo o mecanismo previsto para o anunciante (RNF03).
// Testá-la aqui garante que ela não apodreça sem uso até a task 18.
describe("RNF03 — máscara de CPF para o anunciante", () => {
  it("mostra só os dígitos do meio", () => {
    expect(maskCpf(CPF)).toBe("•••.533.447-••");
  });

  it("nunca devolve o valor original num formato inesperado", () => {
    expect(maskCpf("123")).toBe("•••.•••.•••-••");
    expect(maskCpf("")).toBe("•••.•••.•••-••");
  });
});
