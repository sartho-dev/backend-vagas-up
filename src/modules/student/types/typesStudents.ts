import { Student } from "../schema/Student.schema";

export type StudentCreatedResult = {
  id: string;
  cpf: string;
  name: string;
  email: string;
  birthDate: string;
  // RF03: one or more phone numbers are required at sign-up
  phones: string[];
};

export type StudentProfileResult = {
  id: string;
  cpf: string;
  name: string;
  email: string;
  birthDate: string;
  phones: string[];
  bio: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  languages: { name: string; level: string }[];
  experiences: {
    company: string;
    role: string;
    startDate: string;
    endDate: string | null;
    description: string | null;
  }[];
  skills: string[];
  certifications: {
    name: string;
    issuer: string;
    issuedAt: string;
    expiresAt: string | null;
    credentialUrl: string | null;
  }[];
};

// ---- RF20: admin-facing student management ------------------------------

export type StudentPage = {
  items: Student[];
  total: number;
};

export type ListStudentsOptions = {
  page: number;
  pageSize: number;
  // RN32: partial match, case-insensitive.
  name?: string;
  email?: string;
  // undefined = both; true = active only; false = inactive only.
  active?: boolean;
};

// The repository reports WHAT happened; the service picks the HTTP answer.
export type DeactivateStudentOutcome =
  | "deactivated"
  | "not_found"
  | "already_inactive";

export type ReactivateStudentOutcome =
  | "reactivated"
  | "not_found"
  | "already_active";

// Add these to the IStudentRepository interface:
//
//   // RF20: any student, active or not.
//   findByIdForAdmin(id: string): Promise<Student | null>;
//
//   list(options: ListStudentsOptions): Promise<StudentPage>;
//
//   // RF20 / RN21: returns the outcome instead of throwing, so the service
//   // can decide between 404 (missing) and 409 (already inactive).
//   deactivate(id: string): Promise<DeactivateStudentOutcome>;
//
//   reactivate(id: string): Promise<ReactivateStudentOutcome>;
