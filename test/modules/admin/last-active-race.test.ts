// POR QUE EXISTE: RN21 proíbe ficar sem nenhum admin ativo. Duas requisições
// simultâneas de desativação mútua só podem terminar com um vencedor. Sem o
// lock pessimista do AdminRepository, as duas passariam pela checagem e o
// sistema ficaria sem admin. É o bug que você não enxerga no Postman.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createTestContext,
  TestContext,
  loginAs,
  authHeader,
} from "../../utils/app";
import { truncateAll } from "../../setup/truncate";
import { createAdmin, DEFAULT_PASSWORD } from "../../utils/fixtures";
import { AdminRepository } from "@/modules/admin/repository/AdminRepository";
import { Admin } from "@/modules/admin/schema/Admin.schema";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
});

describe("RN21 — corrida no último admin ativo", () => {
  // O lock vive no repositório, então é lá que a corrida é testada de forma
  // determinística: duas transações concorrentes, sem HTTP no meio.
  it("duas desativações concorrentes: uma passa, a outra vê o último ativo", async () => {
    const a = await createAdmin(ctx.dataSource, ctx.hasher, {
      email: "a@test.local",
    });
    const b = await createAdmin(ctx.dataSource, ctx.hasher, {
      email: "b@test.local",
    });

    const repository = new AdminRepository(ctx.dataSource.getRepository(Admin));

    const outcomes = await Promise.all([
      repository.deactivate(b.id),
      repository.deactivate(a.id),
    ]);

    expect(outcomes.sort()).toEqual(["deactivated", "last_active"]);

    const stillActive = await ctx.dataSource
      .getRepository(Admin)
      .count({ where: { active: true } });
    expect(stillActive).toBe(1);
  });

  // Pela API, o perdedor pode ser recusado de duas formas legítimas: 409, se
  // chegar ao serviço, ou 401, se a própria conta dele já tiver sido
  // desativada antes da requisição autenticar. O que NÃO pode acontecer é as
  // duas passarem — por isso a asserção é sobre a invariante, não sobre um
  // entrelaçamento específico.
  it("apenas um de dois admins simultâneos consegue desativar o outro", async () => {
    const a = await createAdmin(ctx.dataSource, ctx.hasher, {
      email: "a@test.local",
    });
    const b = await createAdmin(ctx.dataSource, ctx.hasher, {
      email: "b@test.local",
    });

    const authA = await loginAs(ctx, "a@test.local", DEFAULT_PASSWORD);
    const authB = await loginAs(ctx, "b@test.local", DEFAULT_PASSWORD);

    const [ra, rb] = await Promise.all([
      ctx.request
        .patch(`/api/v1/admin/administrators/${b.id}/deactivate`)
        .set(authHeader(authA.token)),
      ctx.request
        .patch(`/api/v1/admin/administrators/${a.id}/deactivate`)
        .set(authHeader(authB.token)),
    ]);

    const statuses = [ra.status, rb.status];

    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 401 || s === 409)).toHaveLength(1);

    const stillActive = await ctx.dataSource
      .getRepository(Admin)
      .count({ where: { active: true } });
    expect(stillActive).toBe(1);
  });
});
