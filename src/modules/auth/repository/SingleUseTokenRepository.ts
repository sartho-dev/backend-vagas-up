import { EntityManager, IsNull, LessThan, Not, Repository } from "typeorm";
import { SingleUseToken } from "../schema/SingleUseToken.schema";
import { TokenType } from "../types/TokenType";
import {
  ISingleUseTokenRepository,
  IssueTokenData,
} from "../interfaces/ISingleUseTokenRepository";

export class SingleUseTokenRepository implements ISingleUseTokenRepository {
  constructor(private repository: Repository<SingleUseToken>) {}

  async issue(data: IssueTokenData): Promise<SingleUseToken> {
    return await this.repository.manager.transaction(async (tm) => {
      // RN-A6: "novo pedido invalida o anterior". Apagar em vez de marcar
      // mantém a tabela pequena e deixa o estado sem ambiguidade — o que
      // existe aqui é só o que ainda pode ser usado.
      await tm.delete(SingleUseToken, {
        type: data.type,
        targetEmail: data.targetEmail,
        usedAt: IsNull(),
      });

      const token = tm.create(SingleUseToken, {
        type: data.type,
        targetEmail: data.targetEmail,
        accountType: data.accountType,
        accountId: data.accountId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        usedAt: null,
      });

      return await tm.save(token);
    });
  }

  async consume<T>(
    tokenHash: string,
    type: TokenType,
    now: Date,
    work: (token: SingleUseToken, manager: EntityManager) => Promise<T>,
  ): Promise<T | null> {
    return await this.repository.manager.transaction(async (tm) => {
      const token = await tm.findOne(SingleUseToken, {
        where: { tokenHash, type },
        lock: { mode: "pessimistic_write" },
      });

      // Mesmo tratamento para inexistente, já usado e expirado: quem chama
      // responde igual nos três casos.
      if (!token) return null;
      if (token.usedAt) return null;
      if (token.expiresAt.getTime() <= now.getTime()) return null;

      // Marca ANTES de executar a ação, dentro da transação: se `work`
      // lançar, o rollback desfaz as duas coisas e o link continua válido.
      await tm.update(SingleUseToken, { id: token.id }, { usedAt: now });

      return await work(token, tm);
    });
  }

  async purgeExpired(now: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where({ usedAt: Not(IsNull()) })
      .orWhere({ expiresAt: LessThan(now) })
      .execute();

    return result.affected ?? 0;
  }
}
