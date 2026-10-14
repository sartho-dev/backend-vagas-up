import { AppError } from "../../../shared/errors/AppError";
import { EmailRegistry } from "../../../shared/services/EmailRegistry";
import { AccountRole } from "../../auth/types/AccountRole";
import { Admin } from "../schema/Admin.schema";
import { IAdminRepository } from "../interface/IAdminRepository";
import {
  CreateAdminInput,
  ListAdminsQuery,
  UpdateOwnProfileInput,
} from "../validators/adminValidator";
import {
  AdminListResult,
  AdminResult,
  AdminStudentListResult,
  AdminStudentResult,
  OwnProfileResult,
} from "../types/AdminTypes";
import { ISessionRevoker } from "../../auth/interfaces/ISessionRevoker";
import { IPasswordHasher } from "../../../shared/services/PasswordHasher";
import { IStudentRepository } from "../../student/interfaces/IStudentRepository";
import { Student } from "../../student/schema/Student.schema";
import { maskCpf } from "../../../shared/utils/maskCpf";

// RNF01: bcrypt cost 12 minimum, whatever BCRYPT_COST says.

// What leaves the API. The password hash is never part of it.

function toAdminResult(admin: Admin): AdminResult {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    active: admin.active,
    createdAt: admin.createdAt,
    createdById: admin.createdById ?? null,
  };
}

// RN32: the CPF is masked HERE, in the mapper, so no listing route can ship
// the raw value by forgetting to call the helper.
function toAdminStudentResult(student: Student): AdminStudentResult {
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    cpf: maskCpf(student.cpf),
    active: student.active,
    createdAt: student.createdAt,
  };
}

export class AdminService {
  private bcryptCost: number;

  constructor(
    private repository: IAdminRepository,
    private emails: EmailRegistry,
    private sessions: ISessionRevoker,
    private hasher: IPasswordHasher,
    private students: IStudentRepository,
  ) {}

  // RF21
  async createService(
    actorId: string,
    data: CreateAdminInput,
  ): Promise<AdminResult> {
    // RN06: across students, admins (and, later, responsibles).
    if (await this.emails.isTaken(data.email)) {
      throw new AppError("Email already in use", 409);
    }

    const passwordHash = await this.hasher.hash(data.password);

    const admin = await this.repository.create({
      name: data.name,
      email: data.email,
      passwordHash,
      createdById: actorId,
    });

    return toAdminResult(admin);
  }

  // RF21
  async listService(query: ListAdminsQuery): Promise<AdminListResult> {
    const { items, total } = await this.repository.list({
      page: query.page,
      pageSize: query.pageSize,
      active: query.active,
    });

    return {
      items: items.map(toAdminResult),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  // RF20 / RN32: student listing for the administrator, CPF masked.
  async listStudentsService(
    query: ListAdminsQuery,
  ): Promise<AdminStudentListResult> {
    const { items, total } = await this.students.list({
      page: query.page,
      pageSize: query.pageSize,
      active: query.active,
    });

    return {
      items: items.map(toAdminStudentResult),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  // RF21 / RN21
  async deactivateService(
    actorId: string,
    targetId: string,
  ): Promise<AdminResult> {
    if (actorId === targetId) {
      throw new AppError("You cannot deactivate your own account", 409);
    }

    const outcome = await this.repository.deactivate(targetId);

    if (outcome === "not_found") {
      throw new AppError("Administrator not found", 404);
    }
    if (outcome === "already_inactive") {
      throw new AppError("Administrator is already inactive", 409);
    }
    if (outcome === "last_active") {
      throw new AppError(
        "Cannot deactivate the last active administrator",
        409,
      );
    }

    // RN21: end the sessions now. Even if this step failed, `isActive` already
    // rejects the next request of the deactivated admin.
    await this.sessions.revokeAllSessions(AccountRole.ADMIN, targetId);

    const admin = await this.repository.findById(targetId);
    if (!admin) throw new AppError("Administrator not found", 404);

    return toAdminResult(admin);
  }

  // RF21
  async reactivateService(targetId: string): Promise<AdminResult> {
    const outcome = await this.repository.reactivate(targetId);

    if (outcome === "not_found") {
      throw new AppError("Administrator not found", 404);
    }
    if (outcome === "already_active") {
      throw new AppError("Administrator is already active", 409);
    }

    const admin = await this.repository.findById(targetId);
    if (!admin) throw new AppError("Administrator not found", 404);

    return toAdminResult(admin);
  }

  // RF22 / RN20
  async updateOwnProfileService(
    adminId: string,
    input: UpdateOwnProfileInput,
  ): Promise<OwnProfileResult> {
    let passwordHash: string | undefined;

    if (input.newPassword !== undefined) {
      if (input.currentPassword === undefined) {
        throw new AppError(
          "Current password is required to change the password",
          400,
        );
      }

      const current = await this.repository.findByIdWithPassword(adminId);
      if (!current) throw new AppError("Administrator not found", 404);

      const matches = await this.hasher.verify(
        input.currentPassword,
        current.passwordHash,
      );
      // 400 and not 401: a 401 would look like an expired session to the client.
      if (!matches) throw new AppError("Current password is incorrect", 400);

      passwordHash = await this.hasher.hash(input.newPassword);
    }

    const updated = await this.repository.updateOwn(adminId, {
      name: input.name,
      passwordHash,
    });
    if (!updated) throw new AppError("Administrator not found", 404);

    // RN20: a new password ends ALL sessions, including the one in use.
    if (passwordHash !== undefined) {
      await this.sessions.revokeAllSessions(AccountRole.ADMIN, adminId);
    }

    const admin = await this.repository.findById(adminId);
    if (!admin) throw new AppError("Administrator not found", 404);

    return {
      admin: toAdminResult(admin),
      passwordChanged: passwordHash !== undefined,
    };
  }
}
