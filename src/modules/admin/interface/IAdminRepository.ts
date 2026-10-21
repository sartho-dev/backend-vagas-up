import { Admin } from "../schema/Admin.schema";

export type CreateAdminData = {
  name: string;
  email: string;
  passwordHash: string;
  // RF21: the administrator who is creating this one.
  createdById: string;
};

export type ListAdminsOptions = {
  page: number;
  pageSize: number;
  active?: boolean;
};

export type AdminPage = {
  items: Admin[];
  total: number;
};

// The repository reports WHAT happened; the service decides the HTTP answer.
export type DeactivateOutcome =
  | "deactivated"
  | "not_found"
  | "already_inactive"
  | "last_active";

export type ReactivateOutcome = "reactivated" | "not_found" | "already_active";

export interface IAdminRepository {
  // ---- login / RN06 (subtask 1) ----------------------------------------

  // RF01: the only login query that returns the hash. ACTIVE admins only
  // (RN21: a deactivated account cannot sign in).
  findByEmailWithPassword(email: string): Promise<Admin | null>;

  // Checked on every authenticated request, so deactivating an admin takes
  // effect on the very next request (RF21).
  existsActiveById(id: string): Promise<boolean>;

  // RN06: INCLUDES deactivated admins on purpose (the email stays taken).
  existsByEmail(email: string): Promise<boolean>;
  isEmailTakenByOther(email: string, adminId: string): Promise<boolean>;

  // ---- management (subtask 2) ------------------------------------------

  // Any admin, active or not. Never returns the hash.
  findById(id: string): Promise<Admin | null>;

  // RF22: needed to check the current password. ACTIVE admins only.
  findByIdWithPassword(id: string): Promise<Admin | null>;

  // RF21: throws AppError 409 if the database rejects a duplicate email.
  create(data: CreateAdminData): Promise<Admin>;

  // RF21: stable order (oldest first), so pages never overlap or skip rows.
  list(options: ListAdminsOptions): Promise<AdminPage>;

  // RF28/RF37: a quem avisar que há vaga esperando confirmação de PIX. Só
  // os ATIVOS — admin desativado não recebe mais nada do sistema (RF34).
  // Devolve só os e-mails: quem avisa não precisa do resto da linha.
  listActiveEmails(): Promise<string[]>;

  // RF22: only the provided fields change. Returns false if the active admin
  // does not exist.
  updateOwn(
    id: string,
    changes: { name?: string; passwordHash?: string },
  ): Promise<boolean>;

  // RF21: deactivates unless it would leave NO active administrator. The
  // check and the change happen in ONE transaction that locks the active rows,
  // so two admins deactivating each other at the same time cannot both succeed.
  deactivate(id: string): Promise<DeactivateOutcome>;

  reactivate(id: string): Promise<ReactivateOutcome>;

  // RN-A4: persiste o contador de falhas e o fim do bloqueio.
  recordLoginFailure(
    accountId: string,
    failedLogins: number,
    blockedUntil: Date | null,
  ): Promise<void>;

  clearLoginFailures(accountId: string): Promise<void>;

  // RN-A6 / RF03
  updatePassword(accountId: string, passwordHash: string): Promise<void>;
  updateEmail(accountId: string, email: string): Promise<void>;
}
