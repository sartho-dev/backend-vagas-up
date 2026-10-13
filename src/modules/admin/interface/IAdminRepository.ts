import { Admin } from "../schema/Admin.schema";

// Subtask 1 only needs what login and the RN06 check use. Creating, listing
// and deactivating admins (RF21 / RF22) are added to this interface in
// subtask 2.
export interface IAdminRepository {
  // RF01: the only method that returns the password hash. ACTIVE admins only
  // (RN21: a deactivated account cannot sign in).
  findByEmailWithPassword(email: string): Promise<Admin | null>;

  // Used by the auth module on every authenticated request (cheap check), so
  // deactivating an admin takes effect on the very next request (RF21).
  existsActiveById(id: string): Promise<boolean>;

  // RN06: INCLUDES deactivated admins on purpose. The email stays taken after
  // deactivation (the column is unique in the database).
  existsByEmail(email: string): Promise<boolean>;

  // RN06 on edit: is this email used by ANY admin other than this one?
  // Includes deactivated admins.
  isEmailTakenByOther(email: string, adminId: string): Promise<boolean>;
}
