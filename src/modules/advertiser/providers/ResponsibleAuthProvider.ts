import {
  IAuthAccountProvider,
  LoginAccount,
} from "../../auth/interfaces/IAuthAccountProvider";
import { AccountRole } from "../../auth/types/AccountRole";
import { IResponsibleRepository } from "../interfaces/IResponsibleRepository";

// Terceiro perfil a entrar na autenticação. Note que não há regra nova
// aqui: login, bloqueio por tentativas (RN-A4), recuperação de senha
// (RN-A6) e troca de e-mail (RF03) passam a valer para o responsável só
// por implementar esta interface e registrar o provider no container.
export class ResponsibleAuthProvider implements IAuthAccountProvider {
  readonly role = AccountRole.RESPONSIBLE;

  constructor(private responsibles: IResponsibleRepository) {}

  async findForLogin(email: string): Promise<LoginAccount | null> {
    const account = await this.responsibles.findByEmailWithPassword(email);

    return account
      ? {
          id: account.id,
          passwordHash: account.passwordHash,
          failedLogins: account.failedLogins,
          blockedUntil: account.blockedUntil,
        }
      : null;
  }

  async isActive(accountId: string): Promise<boolean> {
    return await this.responsibles.existsActiveById(accountId);
  }

  async recordLoginFailure(
    accountId: string,
    failedLogins: number,
    blockedUntil: Date | null,
  ): Promise<void> {
    await this.responsibles.recordLoginFailure(
      accountId,
      failedLogins,
      blockedUntil,
    );
  }

  async clearLoginFailures(accountId: string): Promise<void> {
    await this.responsibles.clearLoginFailures(accountId);
  }

  async updatePassword(accountId: string, passwordHash: string): Promise<void> {
    await this.responsibles.updatePassword(accountId, passwordHash);
  }

  async updateEmail(accountId: string, email: string): Promise<void> {
    await this.responsibles.updateEmail(accountId, email);
  }
}
