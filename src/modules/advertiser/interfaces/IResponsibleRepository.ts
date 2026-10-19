import { Responsible } from "../schema/Responsible.schema";
import { IEmailLookup } from "../../../shared/services/EmailRegistry";

// Tudo o que a autenticação precisa de um perfil, mais o lookup de e-mail
// da RN-A7. Mesmo contrato que `students` e `admins` já cumprem.
export interface IResponsibleRepository extends IEmailLookup {
  findByEmailWithPassword(email: string): Promise<Responsible | null>;
  existsActiveById(id: string): Promise<boolean>;
  findById(id: string): Promise<Responsible | null>;

  recordLoginFailure(
    accountId: string,
    failedLogins: number,
    blockedUntil: Date | null,
  ): Promise<void>;
  clearLoginFailures(accountId: string): Promise<void>;

  updatePassword(accountId: string, passwordHash: string): Promise<void>;
  updateEmail(accountId: string, email: string): Promise<void>;
}
