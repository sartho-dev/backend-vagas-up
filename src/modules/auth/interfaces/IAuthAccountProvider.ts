import { AccountRole } from "../types/AccountRole";

export type LoginAccount = {
  id: string;
  passwordHash: string;
  // RN-A4: estado do bloqueio por tentativas, lido junto com o hash para o
  // login não precisar de uma segunda consulta.
  failedLogins: number;
  blockedUntil: Date | null;
};

// One provider per kind of account. The auth module does not know about the
// student/responsible/admin tables; each of those modules plugs in here.
export interface IAuthAccountProvider {
  readonly role: AccountRole;

  // ACTIVE accounts only, including the password hash. null if none.
  findForLogin(email: string): Promise<LoginAccount | null>;

  // Checked on every request, so deactivation (RF10 / RF20) takes effect
  // immediately.
  isActive(accountId: string): Promise<boolean>;

  // RN-A4: persists the new failure counter and, once the limit is reached,
  // the instant until which login is refused.
  recordLoginFailure(
    accountId: string,
    failedLogins: number,
    blockedUntil: Date | null,
  ): Promise<void>;

  // RN-A4: a successful login clears the counter.
  clearLoginFailures(accountId: string): Promise<void>;

  // RN-A6: password recovery writes the new hash. The rule (length, cost) is
  // applied upstream — the provider only persists.
  updatePassword(accountId: string, passwordHash: string): Promise<void>;

  // RF03: the email only changes after the owner confirms it through the
  // link sent to the NEW address.
  updateEmail(accountId: string, email: string): Promise<void>;
}
