import { EntityManager } from "typeorm";
import { SingleUseToken } from "../schema/SingleUseToken.schema";
import { AccountRole } from "../types/AccountRole";
import { TokenType } from "../types/TokenType";

export type IssueTokenData = {
  type: TokenType;
  targetEmail: string;
  accountType: AccountRole | null;
  accountId: string | null;
  tokenHash: string;
  expiresAt: Date;
};

export interface ISingleUseTokenRepository {
  // RN-A6: emitir invalida os pedidos anteriores do mesmo tipo para o mesmo
  // endereço. As duas operações vão na mesma transação, senão uma falha no
  // meio deixaria dois links válidos.
  issue(data: IssueTokenData): Promise<SingleUseToken>;

  // Executa `work` SÓ se o token existir, for do tipo certo, não tiver sido
  // usado e não tiver expirado — e marca o token como usado na MESMA
  // transação. A linha é travada (`pessimistic_write`), então duas
  // requisições simultâneas com o mesmo link não executam a ação duas vezes.
  //
  // Devolve null quando o token não serve, para o chamador responder sempre
  // a mesma coisa (a RN-A6 não deixa distinguir inválido de expirado).
  consume<T>(
    tokenHash: string,
    type: TokenType,
    now: Date,
    work: (token: SingleUseToken, manager: EntityManager) => Promise<T>,
  ): Promise<T | null>;

  // Limpeza: tokens já usados ou vencidos não servem mais para nada.
  purgeExpired(now: Date): Promise<number>;
}
