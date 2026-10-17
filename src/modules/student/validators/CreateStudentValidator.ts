import { z } from "zod";
import { passwordSchema } from "../../../shared/validators/passwordSchema";
import {
  hasMinimumAge,
  MIN_AGE_YEARS,
} from "../../../shared/services/CalculatorBirthDate";
import { config } from "../../../shared/config";
import {
  EducationLevel,
  ProfileVisibility,
  PUBLIC_VISIBILITY_MIN_AGE,
} from "../types/StudentEnums";

// ============================================================================
// Reusable primitive schemas (Create + Update)
// ============================================================================

// Real CPF check: 11 digits, not a repeated sequence, valid check digits.
function isValidCpf(cpf: string): boolean {
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const checkDigit = (base: string, firstWeight: number): number => {
    let weight = firstWeight;
    let sum = 0;
    for (const digit of base) {
      sum += Number(digit) * weight;
      weight -= 1;
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    checkDigit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    checkDigit(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

// RN06 / RNF03: CPF as 11 digits, no punctuation
export const cpfSchema = z
  .string()
  .trim()
  .regex(/^\d{11}$/, "CPF must contain exactly 11 digits, no punctuation")
  .refine(isValidCpf, "CPF is not valid");

// RN06: email must be unique, so it is normalised (trim + lowercase) BEFORE
// being validated. Otherwise "Ana@x.com" and "ana@x.com" would be two accounts.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Invalid email"));

export const nameSchema = z
  .string()
  .trim()
  .min(3, "Name must have at least 3 characters")
  .max(150, "Name must be at most 150 characters");

// RNF01: minimum strength here; the hash (bcrypt cost 12) happens in the service.
// bcrypt only reads the first 72 BYTES (not characters), so the limit is
// measured in bytes — accents and emojis take more than one byte each.

// True only for real calendar dates ("2024-02-31" is rejected).
export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// "YYYY-MM-DD" string that is a real calendar date (matches `type: "date"`).
export const calendarDateSchema = (field: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${field} must be in YYYY-MM-DD format`)
    .refine(isValidCalendarDate, `${field} is not a valid calendar date`);

export const birthDateSchema = calendarDateSchema("birthDate")
  .refine((value) => new Date(`${value}T00:00:00Z`).getTime() <= Date.now(), {
    message: "birthDate cannot be in the future",
  })
  .refine(
    (value) => hasMinimumAge(value, MIN_AGE_YEARS, new Date(), config.timezone),
    { message: `Student must be at least ${MIN_AGE_YEARS} years old` },
  );

// RF10 / RN-C11: o telefone é OPCIONAL na v4.9, e cada número carrega a
// marca "este número tem WhatsApp".
export const phoneNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{10,11}$/, "Phone must contain 10 or 11 digits, no punctuation");

export const phoneSchema = z
  .object({
    number: phoneNumberSchema,
    isWhatsapp: z.boolean().default(false),
  })
  .strict();

export const phonesSchema = z
  .array(phoneSchema)
  .max(5, "At most 5 phone numbers are allowed")
  .refine(
    (phones) => new Set(phones.map((p) => p.number)).size === phones.length,
    { message: "Duplicate phone numbers are not allowed" },
  )
  .default([]);

// ============================================================================
// Professional profile schemas (RF04) — optional, used on Update
// ============================================================================

export const urlSchema = z
  .url("Must be a valid URL")
  .max(255, "URL must be at most 255 characters")
  .nullable();

// RN-C10: o link de currículo é o único campo que aponta para fora do site,
// então é o de maior risco. Três travas: só https, só domínios conhecidos de
// armazenamento/portfólio, e o sistema nunca guarda o arquivo — só o endereço.
const ALLOWED_RESUME_HOSTS = [
  "drive.google.com",
  "docs.google.com",
  "onedrive.live.com",
  "1drv.ms",
  "dropbox.com",
  "linkedin.com",
  "github.com",
  "canva.com",
];

function isAllowedResumeUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  // Compara o host inteiro ou um subdomínio dele. O ponto antes do domínio
  // evita que "evil-github.com" passe por "github.com".
  return ALLOWED_RESUME_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

export const resumeUrlSchema = z
  .string()
  .trim()
  .max(255, "URL must be at most 255 characters")
  .refine(isAllowedResumeUrl, {
    message:
      "O link do currículo precisa ser https e de um domínio permitido " +
      "(Google Drive, OneDrive, Dropbox, LinkedIn, GitHub ou Canva)",
  })
  .nullable();

// RF10 / RN-C2
export const citySchema = z
  .string()
  .trim()
  .min(2, "City must have at least 2 characters")
  .max(120, "City must be at most 120 characters");

export const educationLevelSchema = z.enum(EducationLevel, {
  error: "Escolaridade inválida",
});

// RF13 / RN-C9
export const visibilitySchema = z.enum(ProfileVisibility, {
  error: "Visibilidade inválida",
});

export const bioSchema = z
  .string()
  .trim()
  .max(1000, "Bio must be at most 1000 characters")
  .nullable();

// ============================================================================
// RF03 — Student sign-up
// ============================================================================
//
// LGPD consent (RF03 / RNF03): the client only says "I accept" (true).
// The timestamp is generated by the SERVER in the service, so the client
// cannot choose the date that gets recorded as the moment of consent.

export const createStudentSchema = z
  .object({
    cpf: cpfSchema,
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    birthDate: birthDateSchema,
    city: citySchema,
    educationLevel: educationLevelSchema,
    phones: phonesSchema,
    visibility: visibilitySchema.default(ProfileVisibility.HIDDEN),
    acceptedTerms: z.literal(true, {
      error: "You must accept the terms of use",
    }),
    acceptedPrivacy: z.literal(true, {
      error: "You must accept the privacy policy",
    }),
  })
  .strict() // rejects unknown fields
  // RN-C9: menor de 18 não pode escolher PUBLICO. A checagem é aqui, e não
  // em cada campo, porque depende de dois campos ao mesmo tempo.
  .superRefine((data, ctx) => {
    if (
      data.visibility === ProfileVisibility.PUBLIC &&
      !hasMinimumAge(
        data.birthDate,
        PUBLIC_VISIBILITY_MIN_AGE,
        new Date(),
        config.timezone,
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["visibility"],
        message: `Menores de ${PUBLIC_VISIBILITY_MIN_AGE} anos não podem tornar o perfil público`,
      });
    }
  });

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
