import { Session } from "../schema/Session.schema";
import { AccountRole } from "../types/AccountRole";

export interface ISessionRepository {
  create(data: {
    accountType: AccountRole;
    accountId: string;
    tokenHash: string;
    now: Date;
  }): Promise<Session>;

  findByTokenHash(tokenHash: string): Promise<Session | null>;

  // Sliding idle timeout (RNF02)
  touch(sessionId: string, at: Date): Promise<void>;

  // Logout (RF01)
  revoke(sessionId: string, at: Date): Promise<void>;

  // For account deactivation / password change: ends every session at once
  revokeAllForAccount(
    accountType: AccountRole,
    accountId: string,
    at: Date,
  ): Promise<void>;

  findByUserId(userId: string): Promise<Session | null>;

  replaceActiveSession(data: {
    accountType: AccountRole;
    accountId: string;
    tokenHash: string;
    now: Date;
  }): Promise<Session>;

  // Limpeza: remove sessões que já não podem autenticar ninguém (revogadas,
  // ociosas além do limite ou velhas demais). Sem isso a tabela só cresce.
  purgeExpired(now: Date, idleMs: number, maxAgeMs: number): Promise<number>;
}
