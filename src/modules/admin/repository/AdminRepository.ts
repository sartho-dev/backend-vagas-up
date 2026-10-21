import { Not, QueryFailedError, Repository } from "typeorm";
import { Admin } from "../schema/Admin.schema";
import {
  AdminPage,
  CreateAdminData,
  DeactivateOutcome,
  IAdminRepository,
  ListAdminsOptions,
  ReactivateOutcome,
} from "../interface/IAdminRepository";
import { AppError } from "../../../shared/errors/AppError";

// Postgres unique_violation. The service checks the email first (friendly
// early answer), but two simultaneous requests can both pass that check, so the
// unique constraint is the real guarantee. Here it becomes a 409, not a 500.
const PG_UNIQUE_VIOLATION = "23505";

function rethrowUniqueViolation(error: unknown): never {
  if (error instanceof QueryFailedError) {
    const driverError = error.driverError as { code?: string } | undefined;

    if (driverError?.code === PG_UNIQUE_VIOLATION) {
      throw new AppError("Email already in use", 409);
    }
  }

  throw error;
}

export class AdminRepository implements IAdminRepository {
  constructor(private repository: Repository<Admin>) {}

  // ---- login / RN06 ------------------------------------------------------

  // passwordHash carries `select: false`, so it must be asked for explicitly.
  async findByEmailWithPassword(email: string): Promise<Admin | null> {
    return await this.repository.findOne({
      where: { email, active: true },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        active: true,
        failedLogins: true,
        blockedUntil: true,
      },
    });
  }

  async existsActiveById(id: string): Promise<boolean> {
    return await this.repository.exists({ where: { id, active: true } });
  }

  async existsByEmail(email: string): Promise<boolean> {
    return await this.repository.exists({ where: { email } });
  }

  async isEmailTakenByOther(email: string, adminId: string): Promise<boolean> {
    return await this.repository.exists({
      where: { email, id: Not(adminId) },
    });
  }

  // ---- management --------------------------------------------------------

  async findById(id: string): Promise<Admin | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async findByIdWithPassword(id: string): Promise<Admin | null> {
    return await this.repository.findOne({
      where: { id, active: true },
      select: { id: true, email: true, passwordHash: true, active: true },
    });
  }

  async create(data: CreateAdminData): Promise<Admin> {
    try {
      const admin = this.repository.create({
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        active: true,
        createdById: data.createdById,
      });

      return await this.repository.save(admin);
    } catch (error) {
      rethrowUniqueViolation(error);
    }
  }

  async list(options: ListAdminsOptions): Promise<AdminPage> {
    const [items, total] = await this.repository.findAndCount({
      where: options.active === undefined ? {} : { active: options.active },
      // id breaks ties, so the order is total and pages are stable.
      order: { createdAt: "ASC", id: "ASC" },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    });

    return { items, total };
  }

  async listActiveEmails(): Promise<string[]> {
    const admins = await this.repository.find({
      where: { active: true },
      select: { email: true },
      order: { createdAt: "ASC" },
    });

    return admins.map((admin) => admin.email);
  }

  async updateOwn(
    id: string,
    changes: { name?: string; passwordHash?: string },
  ): Promise<boolean> {
    // Built field by field so an `undefined` never overwrites a column.
    const values: Partial<Pick<Admin, "name" | "passwordHash">> = {};
    if (changes.name !== undefined) values.name = changes.name;
    if (changes.passwordHash !== undefined) {
      values.passwordHash = changes.passwordHash;
    }

    const result = await this.repository.update({ id, active: true }, values);

    return (result.affected ?? 0) > 0;
  }

  // RF21: "never deactivate the last active administrator", made race-proof.
  //
  // Locking the ACTIVE rows (in a fixed order, to avoid deadlocks) makes
  // concurrent deactivations queue up. In READ COMMITTED, a waiting transaction
  // re-reads the rows after the first one commits, so it sees the new, smaller
  // set of active admins and refuses when only one is left.
  async deactivate(id: string): Promise<DeactivateOutcome> {
    return await this.repository.manager.transaction(async (tm) => {
      const activeAdmins = await tm.find(Admin, {
        select: { id: true },
        where: { active: true },
        order: { id: "ASC" },
        lock: { mode: "pessimistic_write" },
      });

      // Read AFTER the lock, so this is the current state, not a stale one.
      const target = await tm.findOne(Admin, {
        select: { id: true, active: true },
        where: { id },
      });

      if (!target) return "not_found";
      if (!target.active) return "already_inactive";
      if (activeAdmins.length <= 1) return "last_active";

      await tm.update(Admin, { id }, { active: false });

      return "deactivated";
    });
  }

  async reactivate(id: string): Promise<ReactivateOutcome> {
    const result = await this.repository.update(
      { id, active: false },
      { active: true },
    );

    if ((result.affected ?? 0) > 0) return "reactivated";

    const exists = await this.repository.exists({ where: { id } });

    return exists ? "already_active" : "not_found";
  }

  // RN-A4
  async recordLoginFailure(
    accountId: string,
    failedLogins: number,
    blockedUntil: Date | null,
  ): Promise<void> {
    await this.repository.update({ id: accountId }, { failedLogins, blockedUntil });
  }

  // RN-A4
  async clearLoginFailures(accountId: string): Promise<void> {
    await this.repository.update(
      { id: accountId },
      { failedLogins: 0, blockedUntil: null },
    );
  }

  // RN-A6
  async updatePassword(accountId: string, passwordHash: string): Promise<void> {
    await this.repository.update({ id: accountId }, { passwordHash });
  }

  // RF03
  async updateEmail(accountId: string, email: string): Promise<void> {
    await this.repository.update({ id: accountId }, { email });
  }
}
