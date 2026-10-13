import {
  IAuthAccountProvider,
  LoginAccount,
} from "../../auth/interfaces/IAuthAccountProvider";
import { AccountRole } from "../../auth/types/AccountRole";
import { IAdminRepository } from "../interface/IAdminRepository";

// Place at: src/modules/auth/providers/AdminAuthProvider.ts
export class AdminAuthProvider implements IAuthAccountProvider {
  readonly role = AccountRole.ADMIN;

  constructor(private admins: IAdminRepository) {}

  async findForLogin(email: string): Promise<LoginAccount | null> {
    // RF01: findByEmailWithPassword is the only query that returns the hash,
    // and it only returns ACTIVE admins (RN21: a deactivated account cannot
    // sign in).
    const admin = await this.admins.findByEmailWithPassword(email);

    return admin ? { id: admin.id, passwordHash: admin.passwordHash } : null;
  }

  // Checked on every request by AuthService.authenticate, so deactivating an
  // admin (RF21) takes effect on the very next request.
  async isActive(accountId: string): Promise<boolean> {
    return await this.admins.existsActiveById(accountId);
  }
}
