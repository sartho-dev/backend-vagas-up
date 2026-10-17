import { AppError } from "../../../shared/errors/AppError";
import { IStudentRepository } from "../interfaces/IStudentRepository";
import { CreateStudentInput } from "../validators/CreateStudentValidator";
import { UpdateStudentInput } from "../validators/UpdateStudentValidator";
import {
  StudentCreatedResult,
  StudentProfileResult,
} from "../types/typesStudents";
import { toProfileResult } from "./toProfileResult";
import { EmailRegistry } from "../../../shared/services/EmailRegistry";
import { AccountRole } from "../../auth/types/AccountRole";
import { IPasswordHasher } from "../../../shared/services/PasswordHasher";
import {
  ProfileVisibility,
  PUBLIC_VISIBILITY_MIN_AGE,
} from "../types/StudentEnums";
import { hasMinimumAge } from "../../../shared/services/CalculatorBirthDate";
import { config } from "../../../shared/config";

// RNF01: bcrypt with cost 12 minimum

export class StudentService {
  // Depends on the interface, not on the TypeORM implementation.
  constructor(
    private repository: IStudentRepository,
    private emails: EmailRegistry,
    private hasher: IPasswordHasher,
  ) {}

  async createService(data: CreateStudentInput): Promise<StudentCreatedResult> {
    // RN06: friendly early answer. The database unique constraint (translated
    // to a 409 in the repository) covers the simultaneous-request case.
    if (await this.emails.isTaken(data.email)) {
      throw new AppError("Email already in use", 409);
    }

    if (await this.repository.existsByCpf(data.cpf)) {
      throw new AppError("CPF already in use", 409);
    }

    const passwordHash = await this.hasher.hash(data.password);

    // RF03 / RNF03: the consent moment is recorded by the server, never taken
    // from the client. The validator already guarantees both flags are true.
    const acceptedAt = new Date();

    const student = await this.repository.create({
      cpf: data.cpf,
      name: data.name,
      email: data.email,
      passwordHash,
      birthDate: data.birthDate,
      city: data.city,
      educationLevel: data.educationLevel,
      visibility: data.visibility,
      phones: data.phones,
      termsAcceptedAt: acceptedAt,
      privacyAcceptedAt: acceptedAt,
    });

    return {
      id: student.id,
      cpf: student.cpf,
      name: student.name,
      email: student.email,
      birthDate: student.birthDate,
      city: student.city,
      educationLevel: student.educationLevel,
      visibility: student.visibility,
      phones: student.phones.map((phone) => ({
        number: phone.number,
        isWhatsapp: phone.isWhatsapp,
      })),
    };
  }

  async updateService(
    studentId: string,
    data: UpdateStudentInput,
  ): Promise<StudentProfileResult> {
    // RN06: only when the email is actually being changed. The check excludes
    // this student, so re-sending their current email is not a conflict. The
    // database unique constraint (409 in the repository) still covers the
    // simultaneous-request case.
    if (
      data.email !== undefined &&
      (await this.emails.isTakenByOther(data.email, {
        role: AccountRole.STUDENT,
        id: studentId,
      }))
    ) {
      throw new AppError("Email already in use", 409);
    }

    // RN-C9: menor de 18 não pode tornar o perfil público. No cadastro a
    // trava está no validator, que tem a data de nascimento em mãos; aqui ela
    // precisa vir do banco, então a checagem é feita no service.
    if (data.visibility === ProfileVisibility.PUBLIC) {
      const current = await this.repository.findById(studentId);

      if (!current) {
        throw new AppError("Student not found", 404);
      }

      if (
        !hasMinimumAge(
          current.birthDate,
          PUBLIC_VISIBILITY_MIN_AGE,
          new Date(),
          config.timezone,
        )
      ) {
        throw new AppError(
          `Menores de ${PUBLIC_VISIBILITY_MIN_AGE} anos não podem tornar o perfil público`,
          403,
        );
      }
    }

    // Throws 404 if the student does not exist or is deactivated.
    await this.repository.update(studentId, data);

    const student = await this.repository.findById(studentId);

    if (!student) {
      throw new AppError("Student not found", 404);
    }

    return toProfileResult(student);
  }
}
