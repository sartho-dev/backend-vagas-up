import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../../../shared/errors/AppError";
import {
  IAuthAccountProvider,
  LoginAccount,
} from "../interfaces/IAuthAccountProvider";
import { ISessionRepository } from "../interfaces/ISessionRepository";
import { AccountRole, AuthContext } from "../types/AccountRole";
import { LoginInput } from "../validators/LoginValidator";
import { config } from "../../../shared/config";
import { IPasswordHasher } from "../../../shared/services/PasswordHasher";

export type LoginResult = {
  token: string;
  accountId: string;
  role: AccountRole;
  idleTimeoutMinutes: number;
};

// RN23: mensagem unica para e-mail inexistente, senha errada e conta
// inativa. Qualquer variacao aqui vira um oraculo de enumeracao de contas.
const INVALID_CREDENTIALS = "E-mail ou senha inválidos";
const INVALID_SESSION = "Invalid or expired session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class AuthService {
  private providersByRole: Map<AccountRole, IAuthAccountProvider>;

  private dummyHash: Promise<string>;

  constructor(
    private providers: IAuthAccountProvider[],
    private sessions: ISessionRepository,
    private hasher: IPasswordHasher,
    private now: () => Date = () => new Date(),
  ) {
    this.providersByRole = new Map(providers.map((p) => [p.role, p]));
    this.dummyHash = this.hasher.hash(randomBytes(16).toString("hex"));
  }

  // RF01
  async login(input: LoginInput): Promise<LoginResult> {
    // RN06: an email is unique across ALL kinds of account, so the first
    // provider that knows it is the right one.

    const emailUser = input.email;

    let found: ({ provider: IAuthAccountProvider } & LoginAccount) | null =
      null;

    for (const provider of this.providers) {
      const account = await provider.findForLogin(emailUser);
      if (account) {
        found = { provider, ...account };
        break;
      }
    }

    const now = this.now();

    // RN-A4: uma conta bloqueada responde como credencial inválida. A
    // comparação de senha roda mesmo assim: sair antes dela tornaria a
    // resposta visivelmente mais rápida e denunciaria que o e-mail existe,
    // que é justamente o que a RN-A1 evita.
    const blocked =
      found?.blockedUntil != null &&
      found.blockedUntil.getTime() > now.getTime();

    const hashToCompare = found ? found.passwordHash : await this.dummyHash;
    const passwordMatches = await this.hasher.verify(
      input.password,
      hashToCompare,
    );

    if (blocked) {
      throw new AppError(INVALID_CREDENTIALS, 401);
    }

    // Same message for unknown email, wrong password and inactive account.
    if (!found || !passwordMatches) {
      if (found) {
        const failures = found.failedLogins + 1;
        const reached = failures >= config.loginMaxAttempts;

        // Ao bloquear, o contador volta a zero: terminado o bloqueio, a conta
        // recebe um ciclo novo e completo de tentativas.
        await found.provider.recordLoginFailure(
          found.id,
          reached ? 0 : failures,
          reached ? new Date(now.getTime() + config.loginBlockMs) : null,
        );
      }

      throw new AppError(INVALID_CREDENTIALS, 401);
    }

    // RN-A4: login bem-sucedido zera o contador.
    if (found.failedLogins > 0 || found.blockedUntil) {
      await found.provider.clearLoginFailures(found.id);
    }

    // 256 random bits; only the hash is stored.
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);

    await this.sessions.replaceActiveSession({
      accountType: found.provider.role,
      accountId: found.id,
      tokenHash,
      now,
    });

    return {
      token,
      accountId: found.id,
      role: found.provider.role,
      idleTimeoutMinutes: config.sessionIdleMs / 60_000,
    };
  }

  // RF01 / RF02 / RNF02: called by the authenticate middleware on every
  // protected request.
  async authenticate(token: string): Promise<AuthContext> {
    const now = this.now();
    const session = await this.sessions.findByTokenHash(hashToken(token));

    if (!session || session.revokedAt) {
      throw new AppError(INVALID_SESSION, 401);
    }

    const idleFor = now.getTime() - session.lastUsedAt.getTime();
    const age = now.getTime() - session.createdAt.getTime();

    if (idleFor > config.sessionIdleMs || age > config.sessionMaxAgeMs) {
      await this.sessions.revoke(session.id, now);
      throw new AppError(INVALID_SESSION, 401);
    }

    // RF10 / RF20: a deactivated account loses access immediately.
    const provider = this.providersByRole.get(session.accountType);
    const stillActive = provider
      ? await provider.isActive(session.accountId)
      : false;

    if (!stillActive) {
      await this.sessions.revoke(session.id, now);
      throw new AppError(INVALID_SESSION, 401);
    }

    if (idleFor > config.touchThrottleMs) {
      await this.sessions.touch(session.id, now);
    }

    return {
      sessionId: session.id,
      accountId: session.accountId,
      role: session.accountType,
    };
  }

  // RF01
  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId, this.now());
  }

  // To be called when an account is deactivated or its password changes.
  async revokeAllSessions(role: AccountRole, accountId: string): Promise<void> {
    await this.sessions.revokeAllForAccount(role, accountId, this.now());
  }
}
