import { randomBytes } from "node:crypto";
import { EntityManager } from "typeorm";
import { hashToken } from "../../../shared/utils/hashToken";
import { ISingleUseTokenRepository } from "../interfaces/ISingleUseTokenRepository";
import { SingleUseToken } from "../schema/SingleUseToken.schema";
import { AccountRole } from "../types/AccountRole";
import { TokenType } from "../types/TokenType";
import { config } from "../../../shared/config";

export type IssueParams = {
  type: TokenType;
  targetEmail: string;
  accountType?: AccountRole | null;
  accountId?: string | null;
};

// Validade por tipo. A RN-A6 fixa 30 min para recuperação; o RF22 fixa 72 h
// para o convite. A troca de e-mail segue a recuperação por ser do mesmo
// tipo de risco (tomada de conta).
const TTL_MS: Record<TokenType, number> = {
  [TokenType.PASSWORD_RECOVERY]: config.recoveryTokenTtlMs,
  [TokenType.EMAIL_CHANGE]: config.recoveryTokenTtlMs,
  [TokenType.INVITE]: config.inviteTokenTtlMs,
};

export class SingleUseTokenService {
  constructor(
    private tokens: ISingleUseTokenRepository,
    private now: () => Date = () => new Date(),
  ) {}

  // Devolve o token CRU — é a única vez em que ele existe. Quem chama põe no
  // link do e-mail e descarta; o banco só viu o hash.
  async issue(params: IssueParams): Promise<string> {
    const raw = randomBytes(32).toString("base64url");
    const now = this.now();

    await this.tokens.issue({
      type: params.type,
      targetEmail: params.targetEmail,
      accountType: params.accountType ?? null,
      accountId: params.accountId ?? null,
      tokenHash: hashToken(raw),
      expiresAt: new Date(now.getTime() + TTL_MS[params.type]),
    });

    return raw;
  }

  // Roda `work` apenas se o token servir, e o invalida na mesma transação.
  // Devolve null quando não serve — inexistente, já usado ou expirado são
  // indistinguíveis de propósito (RN-A6).
  async consume<T>(
    rawToken: string,
    type: TokenType,
    work: (token: SingleUseToken, manager: EntityManager) => Promise<T>,
  ): Promise<T | null> {
    return await this.tokens.consume(
      hashToken(rawToken),
      type,
      this.now(),
      work,
    );
  }

  async purgeExpired(): Promise<number> {
    return await this.tokens.purgeExpired(this.now());
  }
}
