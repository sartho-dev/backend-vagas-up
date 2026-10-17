// POR QUE EXISTE: estes tokens são a chave de três portas sensíveis —
// recuperar senha, aceitar convite e confirmar troca de e-mail. Um token
// reutilizável, eterno ou recuperável do banco transforma qualquer uma
// delas em tomada de conta.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { AppDataSource } from "@/shared/database/data-source";
import { SingleUseToken } from "@/modules/auth/schema/SingleUseToken.schema";
import { SingleUseTokenRepository } from "@/modules/auth/repository/SingleUseTokenRepository";
import { SingleUseTokenService } from "@/modules/auth/service/SingleUseTokenService";
import { TokenType } from "@/modules/auth/types/TokenType";
import { AccountRole } from "@/modules/auth/types/AccountRole";
import { hashToken } from "@/shared/utils/hashToken";
import { config } from "@/shared/config";
import { truncateAll } from "../../setup/truncate";

let service: SingleUseTokenService;
let clock: Date;

beforeAll(async () => {
  if (!AppDataSource.isInitialized) await AppDataSource.initialize();

  service = new SingleUseTokenService(
    new SingleUseTokenRepository(AppDataSource.getRepository(SingleUseToken)),
    () => clock,
  );
});

beforeEach(async () => {
  await truncateAll();
  clock = new Date();
});

afterAll(async () => {
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
});

const EMAIL = "alvo@test.local";

function issueRecovery() {
  return service.issue({
    type: TokenType.PASSWORD_RECOVERY,
    targetEmail: EMAIL,
    accountType: AccountRole.STUDENT,
    accountId: "11111111-1111-4111-8111-111111111111",
  });
}

// Executa a ação autorizada pelo token; devolve a marca para o teste checar.
const work = async () => "executou" as const;

describe("RNF01 — o token cru nunca é guardado", () => {
  it("o banco tem só o hash SHA-256", async () => {
    const raw = await issueRecovery();

    const rows = await AppDataSource.getRepository(SingleUseToken).find();

    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(raw));
    expect(rows[0].tokenHash).not.toBe(raw);

    // O valor cru não aparece em NENHUMA coluna.
    expect(JSON.stringify(rows[0])).not.toContain(raw);
  });

  it("uma busca pelo valor cru não acha nada", async () => {
    const raw = await issueRecovery();

    const found = await AppDataSource.getRepository(SingleUseToken).findOne({
      where: { tokenHash: raw },
    });

    expect(found).toBeNull();
  });
});

describe("Uso único", () => {
  it("funciona na primeira vez", async () => {
    const raw = await issueRecovery();

    const result = await service.consume(
      raw,
      TokenType.PASSWORD_RECOVERY,
      work,
    );

    expect(result).toBe("executou");
  });

  it("falha na segunda vez", async () => {
    const raw = await issueRecovery();
    await service.consume(raw, TokenType.PASSWORD_RECOVERY, work);

    const second = await service.consume(
      raw,
      TokenType.PASSWORD_RECOVERY,
      work,
    );

    expect(second).toBeNull();
  });

  it("não serve para outro tipo de token", async () => {
    const raw = await issueRecovery();

    const wrongType = await service.consume(raw, TokenType.INVITE, work);

    expect(wrongType).toBeNull();
  });

  it("se a ação falhar, o token continua válido", async () => {
    const raw = await issueRecovery();

    await expect(
      service.consume(raw, TokenType.PASSWORD_RECOVERY, async () => {
        throw new Error("a ação falhou");
      }),
    ).rejects.toThrow("a ação falhou");

    // O rollback desfez a marcação junto com a ação.
    const retry = await service.consume(raw, TokenType.PASSWORD_RECOVERY, work);
    expect(retry).toBe("executou");
  });
});

describe("Expiração", () => {
  it("o link de recuperação vale 30 minutos", () => {
    expect(config.recoveryTokenTtlMs).toBe(30 * 60 * 1000);
  });

  it("o convite vale 72 horas", () => {
    expect(config.inviteTokenTtlMs).toBe(72 * 60 * 60 * 1000);
  });

  it("aceita um minuto antes de vencer", async () => {
    const raw = await issueRecovery();

    clock = new Date(clock.getTime() + config.recoveryTokenTtlMs - 60_000);

    expect(await service.consume(raw, TokenType.PASSWORD_RECOVERY, work)).toBe(
      "executou",
    );
  });

  it("recusa um minuto depois de vencer, do mesmo jeito que um inválido", async () => {
    const raw = await issueRecovery();

    clock = new Date(clock.getTime() + config.recoveryTokenTtlMs + 60_000);

    const expired = await service.consume(
      raw,
      TokenType.PASSWORD_RECOVERY,
      work,
    );
    const nonsense = await service.consume(
      "token-que-nunca-existiu",
      TokenType.PASSWORD_RECOVERY,
      work,
    );

    // RN-A6: expirado e inexistente são indistinguíveis para quem chama.
    expect(expired).toBeNull();
    expect(nonsense).toBeNull();
    expect(expired).toEqual(nonsense);
  });
});

describe("RN-A6 — pedido novo invalida o anterior", () => {
  it("o primeiro link deixa de funcionar", async () => {
    const first = await issueRecovery();
    const second = await issueRecovery();

    expect(await service.consume(first, TokenType.PASSWORD_RECOVERY, work)).toBe(
      null,
    );
    expect(
      await service.consume(second, TokenType.PASSWORD_RECOVERY, work),
    ).toBe("executou");
  });

  it("não afeta outro tipo nem outro destinatário", async () => {
    const recovery = await issueRecovery();

    await service.issue({ type: TokenType.INVITE, targetEmail: EMAIL });
    await service.issue({
      type: TokenType.PASSWORD_RECOVERY,
      targetEmail: "outro@test.local",
    });

    expect(
      await service.consume(recovery, TokenType.PASSWORD_RECOVERY, work),
    ).toBe("executou");
  });
});

describe("Limpeza", () => {
  it("apaga usados e vencidos, preserva os válidos", async () => {
    const used = await issueRecovery();
    await service.consume(used, TokenType.PASSWORD_RECOVERY, work);

    await service.issue({
      type: TokenType.PASSWORD_RECOVERY,
      targetEmail: "vencido@test.local",
    });
    clock = new Date(clock.getTime() + config.recoveryTokenTtlMs + 1000);

    const valid = await service.issue({
      type: TokenType.INVITE,
      targetEmail: "valido@test.local",
    });

    const removed = await service.purgeExpired();

    expect(removed).toBe(2);
    expect(await service.consume(valid, TokenType.INVITE, work)).toBe(
      "executou",
    );
  });
});
