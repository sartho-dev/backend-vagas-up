import { IsNull, Repository } from "typeorm";
import { Session } from "../schema/Session.schema";
import { ISessionRepository } from "../interfaces/ISessionRepository";
import { AccountRole } from "../types/AccountRole";

export class SessionRepository implements ISessionRepository {
  constructor(private repository: Repository<Session>) {}

  async create(data: {
    accountType: AccountRole;
    accountId: string;
    tokenHash: string;
    now: Date;
  }): Promise<Session> {
    const session = this.repository.create({
      accountType: data.accountType,
      accountId: data.accountId,
      tokenHash: data.tokenHash,
      createdAt: data.now,
      lastUsedAt: data.now,
      revokedAt: null,
    });

    return await this.repository.save(session);
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    return await this.repository.findOne({ where: { tokenHash } });
  }

  async touch(sessionId: string, at: Date): Promise<void> {
    await this.repository.update({ id: sessionId }, { lastUsedAt: at });
  }

  async revoke(sessionId: string, at: Date): Promise<void> {
    await this.repository.update(
      { id: sessionId, revokedAt: IsNull() },
      { revokedAt: at },
    );
  }

  async findByUserId(userId: string): Promise<Session | null> {
    const session = await this.repository.findOne({
      where: { accountId: userId },
    });

    return session;
  }

  async revokeAllForAccount(
    accountType: AccountRole,
    accountId: string,
    at: Date,
  ): Promise<void> {
    await this.repository.update(
      { accountType, accountId, revokedAt: IsNull() },
      { revokedAt: at },
    );
  }

  async replaceActiveSession(data: {
    accountType: AccountRole;
    accountId: string;
    tokenHash: string;
    now: Date;
  }): Promise<Session> {
    return this.repository.manager.transaction(async (tm) => {
      await tm.delete(Session, {
        accountId: data.accountId,
      });

      const session = tm.create(Session, {
        accountId: data.accountId,
        accountType: data.accountType,
        tokenHash: data.tokenHash,
        createdAt: data.now,
        lastUsedAt: data.now,
        revokedAt: null,
      });

      return await tm.save(session);
    });
  }

  async purgeExpired(
    now: Date,
    idleMs: number,
    maxAgeMs: number,
  ): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where("revoked_at IS NOT NULL")
      .orWhere("last_used_at < :idleCutoff", {
        idleCutoff: new Date(now.getTime() - idleMs),
      })
      .orWhere("created_at < :ageCutoff", {
        ageCutoff: new Date(now.getTime() - maxAgeMs),
      })
      .execute();

    return result.affected ?? 0;
  }
}
