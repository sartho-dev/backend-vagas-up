import { DataSource } from "typeorm";
import { Admin } from "@/modules/admin/schema/Admin.schema";
import { Student } from "@/modules/student/schema/Student.schema";
import { StudentPhone } from "@/modules/student/schema/StudentPhone.schema";
import { IPasswordHasher } from "@/shared/services/PasswordHasher";
import {
  EducationLevel,
  ProfileVisibility,
} from "@/modules/student/types/StudentEnums";

export const DEFAULT_PASSWORD = "SenhaForte123";

// Sufixo para evitar colisão quando o teste cria vários usuários.
let counter = 0;
function nextSuffix(): string {
  counter += 1;
  return `${Date.now()}${counter}`;
}

export async function createAdmin(
  ds: DataSource,
  hasher: IPasswordHasher,
  overrides: Partial<Admin> & { password?: string } = {},
): Promise<Admin> {
  const repo = ds.getRepository(Admin);
  const passwordHash = await hasher.hash(
    overrides.password ?? DEFAULT_PASSWORD,
  );

  const admin = repo.create({
    name: overrides.name ?? "Admin Teste",
    email: overrides.email ?? `admin_${nextSuffix()}@test.local`,
    passwordHash,
    active: overrides.active ?? true,
    createdById: overrides.createdById ?? null,
  });

  return repo.save(admin);
}

export async function createStudent(
  ds: DataSource,
  hasher: IPasswordHasher,
  overrides: Partial<Student> & {
    password?: string;
    phoneNumbers?: string[];
  } = {},
): Promise<Student> {
  const repo = ds.getRepository(Student);
  const passwordHash = await hasher.hash(
    overrides.password ?? DEFAULT_PASSWORD,
  );

  const student = repo.create({
    // CPF válido pelo dígito verificador.
    cpf: overrides.cpf ?? "39053344705",
    name: overrides.name ?? "Estudante Teste",
    email: overrides.email ?? `student_${nextSuffix()}@test.local`,
    passwordHash,
    birthDate: overrides.birthDate ?? "2000-01-01",
    city: overrides.city ?? "Campo Grande",
    educationLevel:
      overrides.educationLevel ?? EducationLevel.HIGH_SCHOOL_COMPLETE,
    visibility: overrides.visibility ?? ProfileVisibility.HIDDEN,
    active: overrides.active ?? true,
    termsAcceptedAt: overrides.termsAcceptedAt ?? new Date(),
    privacyAcceptedAt: overrides.privacyAcceptedAt ?? new Date(),
    phones: (overrides.phoneNumbers ?? ["67999999999"]).map((number) => {
      const p = new StudentPhone();
      p.number = number;
      p.isWhatsapp = false;
      return p;
    }),
  });

  return repo.save(student);
}
