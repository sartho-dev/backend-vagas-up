import { AccountRole } from "../../auth/types/AccountRole";

export interface ISessionRevoker {
  revokeAllSessions(role: AccountRole, accountId: string): Promise<void>;
}
