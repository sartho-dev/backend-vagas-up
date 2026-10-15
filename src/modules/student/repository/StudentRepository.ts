import { Not, QueryFailedError, Repository } from "typeorm";
import { Student } from "../schema/Student.schema";
import { StudentPhone } from "../schema/StudentPhone.schema";
import { StudentExperience } from "../schema/StudentExperience.schema";
import { StudentLanguage } from "../schema/StudentLanguage.schema";
import { StudentSkill } from "../schema/StudentSkill.schema";
import { StudentCertification } from "../schema/StudentCertification.schema";
import {
  CreateStudentData,
  IStudentRepository,
} from "../interfaces/IStudentRepository";
import { UpdateStudentInput } from "../validators/UpdateStudentValidator";
import { AppError } from "../../../shared/errors/AppError";

// Postgres unique_violation. The check-then-insert done in the service is only
// a friendly early answer; two simultaneous requests can both pass it, so the
// unique constraint in the database is the real guarantee. Here we turn that
// database error into a 409 instead of letting it surface as a 500.
const PG_UNIQUE_VIOLATION = "23505";

function rethrowUniqueViolation(error: unknown): never {
  if (error instanceof QueryFailedError) {
    const driverError = error.driverError as
      | { code?: string; detail?: string }
      | undefined;

    if (driverError?.code === PG_UNIQUE_VIOLATION) {
      // detail looks like: Key (email)=(ana@x.com) already exists.
      const column = driverError.detail?.match(/^Key \((\w+)\)=/)?.[1];

      if (column === "email") throw new AppError("Email already in use", 409);
      if (column === "cpf") throw new AppError("CPF already in use", 409);
      throw new AppError("Resource already exists", 409);
    }
  }

  throw error;
}

export class StudentRepository implements IStudentRepository {
  constructor(private repository: Repository<Student>) {}

  // RF03: the student and their phone numbers are written together, so a
  // failure halfway through never leaves a student without a phone.
  async create(data: CreateStudentData): Promise<Student> {
    try {
      return await this.repository.manager.transaction(async (tm) => {
        const student = tm.create(Student, {
          cpf: data.cpf,
          name: data.name,
          email: data.email,
          passwordHash: data.passwordHash,
          birthDate: data.birthDate,
          termsAcceptedAt: data.termsAcceptedAt,
          privacyAcceptedAt: data.privacyAcceptedAt,
          phones: data.phones.map((number) => ({ number })),
        });

        return await tm.save(student);
      });
    } catch (error) {
      rethrowUniqueViolation(error);
    }
  }

  // RF20 / RN32: paginated listing for the administrator.
  async list(params: {
    page: number;
    pageSize: number;
    active?: boolean;
  }): Promise<{ items: Student[]; total: number }> {
    const [items, total] = await this.repository.findAndCount({
      where: params.active === undefined ? {} : { active: params.active },
      order: { createdAt: "DESC" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    });

    return { items, total };
  }

  async findById(id: string): Promise<Student | null> {
    return await this.repository.findOne({
      where: { id, active: true },
      relations: {
        phones: true,
        languages: true,
        experiences: true,
        skills: true,
        certifications: true,
      },
    });
  }

  async findByEmail(email: string): Promise<Student | null> {
    return await this.repository.findOne({
      where: { email, active: true },
      relations: { phones: true },
    });
  }

  // RN06: deactivated students are included on purpose — the email stays taken.
  async existsByEmail(email: string): Promise<boolean> {
    return await this.repository.exists({ where: { email } });
  }

  // RN06: deactivated students are included on purpose — the CPF stays taken.
  async existsByCpf(cpf: string): Promise<boolean> {
    return await this.repository.exists({ where: { cpf } });
  }

  async isEmailTakenByOther(
    email: string,
    studentId: string,
  ): Promise<boolean> {
    return await this.repository.exists({
      where: { email, id: Not(studentId) },
    });
  }

  async existsActiveById(id: string): Promise<boolean> {
    return await this.repository.exists({ where: { id, active: true } });
  }

  // RF01: passwordHash carries `select: false`, so it has to be asked for
  // explicitly. This is the only place that does so.
  async findByEmailWithPassword(email: string): Promise<Student | null> {
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

  // RF04: everything runs in ONE transaction. The student is checked first so
  // that a missing/inactive student always answers 404 — even when only
  // phones, languages or experiences are being changed.
  async update(studentId: string, data: UpdateStudentInput): Promise<void> {
    try {
      await this.repository.manager.transaction(async (tm) => {
        const exists = await tm.exists(Student, {
          where: { id: studentId, active: true },
        });

        if (!exists) {
          throw new AppError("Student not found", 404);
        }

        const {
          phones,
          languages,
          experiences,
          skills,
          certifications,
          ...scalarFields
        } = data;

        // PATCH: absent fields (undefined) must not be written; null clears.
        const fieldsToUpdate = Object.fromEntries(
          Object.entries(scalarFields).filter(
            ([, value]) => value !== undefined,
          ),
        ) as Partial<Student>;

        if (Object.keys(fieldsToUpdate).length > 0) {
          await tm.update(Student, { id: studentId }, fieldsToUpdate);
        }

        if (phones) {
          await tm.delete(StudentPhone, { studentId });
          await tm.save(
            phones.map((number) =>
              tm.create(StudentPhone, { studentId, number }),
            ),
          );
        }

        if (languages) {
          await tm.delete(StudentLanguage, { studentId });
          await tm.save(
            languages.map((language) =>
              tm.create(StudentLanguage, {
                studentId,
                name: language.name,
                level: language.level,
              }),
            ),
          );
        }

        if (experiences) {
          await tm.delete(StudentExperience, { studentId });
          await tm.save(
            experiences.map((experience) =>
              tm.create(StudentExperience, {
                studentId,
                company: experience.company,
                role: experience.role,
                startDate: experience.startDate,
                endDate: experience.endDate,
                description: experience.description,
              }),
            ),
          );
        }

        if (skills) {
          await tm.delete(StudentSkill, { studentId });
          await tm.save(
            skills.map((name) => tm.create(StudentSkill, { studentId, name })),
          );
        }

        if (certifications) {
          await tm.delete(StudentCertification, { studentId });
          await tm.save(
            certifications.map((certification) =>
              tm.create(StudentCertification, {
                studentId,
                name: certification.name,
                issuer: certification.issuer,
                issuedAt: certification.issuedAt,
                expiresAt: certification.expiresAt,
                credentialUrl: certification.credentialUrl,
              }),
            ),
          );
        }
      });
    } catch (error) {
      // e.g. changing the email to one that already belongs to someone else
      rethrowUniqueViolation(error);
    }
  }

  // RF04: administrator-only correction. Authorisation is enforced upstream.
  async updateCpf(studentId: string, cpf: string): Promise<void> {
    try {
      const result = await this.repository.update({ id: studentId }, { cpf });

      if (result.affected === 0) {
        throw new AppError("Student not found", 404);
      }
    } catch (error) {
      rethrowUniqueViolation(error);
    }
  }

  // RF10 / RNF08: soft delete. The row is kept so that applications and
  // enrolments keep their foreign keys intact.
  async deactivate(studentId: string): Promise<void> {
    const result = await this.repository.update(
      { id: studentId },
      { active: false },
    );

    if (result.affected === 0) {
      throw new AppError("Student not found", 404);
    }
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
}
