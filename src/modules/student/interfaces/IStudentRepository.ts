import { Student } from "../schema/Student.schema";
import { UpdateStudentInput } from "../validators/UpdateStudentValidator";

// What the repository actually persists on sign-up. The service hashes the
// password and stamps the consent dates, so the repository never receives a
// plain-text password (the old type said `password` but carried a hash).
import {
  EducationLevel,
  ProfileVisibility,
} from "../types/StudentEnums";

export type CreateStudentData = {
  cpf: string;
  name: string;
  email: string;
  passwordHash: string;
  birthDate: string;
  city: string;
  educationLevel: EducationLevel;
  visibility: ProfileVisibility;
  // RN-C11: cada número carrega a marca de WhatsApp.
  phones: StudentPhoneData[];
  termsAcceptedAt: Date;
  privacyAcceptedAt: Date;
};

export type StudentPhoneData = {
  number: string;
  isWhatsapp: boolean;
};

export interface IStudentRepository {
  // RF03
  create(data: CreateStudentData): Promise<Student>;

  // Active students only. Includes phones, languages, experiences, skills and
  // certifications.
  findById(id: string): Promise<Student | null>;
  findByEmail(email: string): Promise<Student | null>;

  // RN06: uniqueness checks for sign-up. They INCLUDE deactivated students on
  // purpose — the email and the CPF stay taken after deactivation (the columns
  // are unique in the database).
  existsByEmail(email: string): Promise<boolean>;
  existsByCpf(cpf: string): Promise<boolean>;

  // RN06 on edit: is this email used by ANY student other than this one?
  // (the student's own current email must not count as a conflict). Includes
  // deactivated students.
  isEmailTakenByOther(email: string, studentId: string): Promise<boolean>;

  // Used by the auth module on every authenticated request (cheap check).
  existsActiveById(id: string): Promise<boolean>;

  // RF01: the only method that returns the password hash
  findByEmailWithPassword(email: string): Promise<Student | null>;

  // RF04: name, email, phones, professional profile, languages, experiences,
  // skills, certifications
  update(studentId: string, data: UpdateStudentInput): Promise<void>;

  // RF04: the CPF may only be corrected by an administrator
  updateCpf(studentId: string, cpf: string): Promise<void>;

  // RF20 / RN32: paginated listing for the administrator
  list(params: {
    page: number;
    pageSize: number;
    active?: boolean;
  }): Promise<{ items: Student[]; total: number }>;

  // RF10 / RNF08: deactivation, never physical deletion
  deactivate(studentId: string): Promise<void>;

  // RN-A4: persiste o contador de falhas e o fim do bloqueio.
  recordLoginFailure(
    accountId: string,
    failedLogins: number,
    blockedUntil: Date | null,
  ): Promise<void>;

  clearLoginFailures(accountId: string): Promise<void>;
}
