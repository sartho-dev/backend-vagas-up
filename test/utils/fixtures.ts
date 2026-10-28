import { DataSource } from "typeorm";
import { Admin } from "@/modules/admin/schema/Admin.schema";
import { Student } from "@/modules/student/schema/Student.schema";
import { StudentPhone } from "@/modules/student/schema/StudentPhone.schema";
import { IPasswordHasher } from "@/shared/services/PasswordHasher";
import {
  EducationLevel,
  ProfileVisibility,
} from "@/modules/student/types/StudentEnums";
import { Advertiser } from "@/modules/advertiser/schema/Advertiser.schema";
import { Responsible } from "@/modules/advertiser/schema/Responsible.schema";
import {
  AdvertiserType,
  VerificationStatus,
} from "@/modules/advertiser/types/AdvertiserEnums";
import { Course } from "@/modules/course/schema/Course.schema";
import { Vacancy } from "@/modules/vacancy/schema/Vacancy.schema";
import {
  VacancyModality,
  VacancySituation,
} from "@/modules/vacancy/types/VacancyEnums";
import { VacancyType } from "@/shared/types/VacancyType";

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

// RF20: anunciante + primeiro responsável, como o cadastro real cria.
export async function createAdvertiser(
  ds: DataSource,
  hasher: IPasswordHasher,
  overrides: {
    type?: AdvertiserType;
    document?: string;
    displayName?: string;
    legalName?: string | null;
    email?: string;
    password?: string;
    verification?: VerificationStatus;
    // RF21: um anunciante só entra na fila depois de pedir. O teste da fila
    // precisa dizer quando o pedido foi feito, porque a ordem é FIFO.
    verificationRequestedAt?: Date | null;
    contactEmail?: string;
  } = {},
): Promise<{ advertiser: Advertiser; responsible: Responsible }> {
  const advertiser = await ds.getRepository(Advertiser).save(
    ds.getRepository(Advertiser).create({
      type: overrides.type ?? AdvertiserType.COMPANY,
      // CNPJ válido pelo dígito verificador.
      document: overrides.document ?? "11222333000181",
      displayName: overrides.displayName ?? "Padaria Teste",
      legalName: overrides.legalName ?? "Padaria Teste LTDA",
      contactEmail: overrides.contactEmail ?? "contato@test.local",
      contactPhone: "67999999999",
      site: null,
      verification: overrides.verification ?? VerificationStatus.PENDING,
      verificationRequestedAt: overrides.verificationRequestedAt ?? null,
    }),
  );

  const responsible = await ds.getRepository(Responsible).save(
    ds.getRepository(Responsible).create({
      advertiserId: advertiser.id,
      name: "Responsável Teste",
      email: overrides.email ?? `resp_${nextSuffix()}@test.local`,
      passwordHash: await hasher.hash(overrides.password ?? DEFAULT_PASSWORD),
      active: true,
    }),
  );

  return { advertiser, responsible };
}

// Corpo válido de vaga para o POST, no formato que a rota recebe. Os testes
// sobrescrevem só o campo que estão exercitando — assim a falha aponta para
// a regra em teste e não para um campo esquecido.
export function vacancyPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: VacancyType.INTERNSHIP,
    title: "Estágio em desenvolvimento",
    description:
      "Vaga de estágio para apoiar o time de desenvolvimento no dia a dia.",
    modality: VacancyModality.ON_SITE,
    city: "Campo Grande",
    workHours: 30,
    minEducation: EducationLevel.UNDERGRADUATE_IN_PROGRESS,
    ...overrides,
  };
}

// Insere a vaga direto no banco, para o teste partir de uma situação que a
// rota levaria vários passos para alcançar (uma vaga já aberta, por
// exemplo). Quem testa o FLUXO usa as rotas, não isto.
export async function createVacancy(
  ds: DataSource,
  advertiserId: string,
  createdBy: string,
  overrides: Partial<Vacancy> = {},
): Promise<Vacancy> {
  const repo = ds.getRepository(Vacancy);

  const vacancy = repo.create({
    advertiserId,
    createdBy,
    type: overrides.type ?? VacancyType.INTERNSHIP,
    title: overrides.title ?? "Estágio em desenvolvimento",
    description: overrides.description ?? "Descrição suficientemente longa.",
    modality: overrides.modality ?? VacancyModality.ON_SITE,
    city: overrides.city ?? "Campo Grande",
    workHours: overrides.workHours ?? 30,
    minEducation:
      overrides.minEducation ?? EducationLevel.UNDERGRADUATE_IN_PROGRESS,
    requiresAdult: overrides.requiresAdult ?? false,
    positions: overrides.positions ?? 1,
    courseId: overrides.courseId ?? null,
    requirements: overrides.requirements ?? null,
    benefits: overrides.benefits ?? null,
    compensation: overrides.compensation ?? null,
    schedule: overrides.schedule ?? null,
    deadline: overrides.deadline ?? null,
    situation: overrides.situation ?? VacancySituation.DRAFT,
    free: overrides.free ?? false,
    value: overrides.value ?? null,
    referenceCode: overrides.referenceCode ?? `REF${nextSuffix().slice(-8)}`,
    // RF42: só a vaga publicada tem endereço. O padrão é nulo porque o
    // padrão desta fixture é rascunho; quem cria vaga aberta passa o slug.
    slug: overrides.slug ?? null,
    publishedAt: overrides.publishedAt ?? null,
    expiresAt: overrides.expiresAt ?? null,
    closedAt: overrides.closedAt ?? null,
  });

  return repo.save(vacancy);
}

// Curso direto no banco. Quem testa a ROTA de cursos usa a rota; isto é
// para quem só precisa de um curso existindo para apontar uma vaga ou uma
// formação para ele.
export async function createCourse(
  ds: DataSource,
  overrides: { name?: string } = {},
): Promise<Course> {
  const repo = ds.getRepository(Course);

  return repo.save(
    repo.create({ name: overrides.name ?? `Curso ${nextSuffix()}` }),
  );
}
