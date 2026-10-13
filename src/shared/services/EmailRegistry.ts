import { AccountRole } from "../../modules/auth/types/AccountRole";

// What a repository must offer so its table takes part in the RN06 check.
export interface IEmailLookup {
  existsByEmail(email: string): Promise<boolean>;
  isEmailTakenByOther(email: string, accountId: string): Promise<boolean>;
}

// RN06: an email is unique across students, responsibles and admins TOGETHER.
// The database unique constraints only cover one table each, so this is the
// cross-table check. When the responsible module exists, register its
// repository here and nothing else has to change.
//
// This is the friendly early answer. A student and an admin created at the
// exact same instant with the same email could both pass it; that race cannot
// be closed by a single constraint across tables, so it is accepted for now.
export class EmailRegistry {
  constructor(private lookups: Map<AccountRole, IEmailLookup>) {}

  // Sign-up: is this email used by ANY account of ANY role?
  async isTaken(email: string): Promise<boolean> {
    const results = await Promise.all(
      [...this.lookups.values()].map((lookup) => lookup.existsByEmail(email)),
    );
    return results.some(Boolean);
  }

  // Edit: is this email used by any account OTHER than the owner's own?
  // In the owner's own table the owner is excluded; in the other tables any
  // match is a conflict.
  async isTakenByOther(
    email: string,
    owner: { role: AccountRole; id: string },
  ): Promise<boolean> {
    const results = await Promise.all(
      [...this.lookups.entries()].map(([role, lookup]) =>
        role === owner.role
          ? lookup.isEmailTakenByOther(email, owner.id)
          : lookup.existsByEmail(email),
      ),
    );
    return results.some(Boolean);
  }
}
