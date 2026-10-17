import { z } from "zod";
import {
  nameSchema,
  emailSchema,
  phonesSchema,
  urlSchema,
  bioSchema,
  calendarDateSchema,
  citySchema,
  educationLevelSchema,
  visibilitySchema,
  resumeUrlSchema,
} from "./CreateStudentValidator";
import { LanguageLevel } from "../schema/StudentLanguage.schema";

// ============================================================================
// Language sub-schemas (RF04)
// ============================================================================

const languageLevelSchema = z.enum(LanguageLevel, {
  error: "Invalid language level",
});

const languageSchema = z
  .object({
    name: z.string().trim().min(2).max(50),
    level: languageLevelSchema,
  })
  .strict();

const languagesSchema = z
  .array(languageSchema)
  .max(10)
  .refine(
    (list) =>
      new Set(list.map((l) => l.name.trim().toLowerCase())).size ===
      list.length,
    { message: "Duplicate languages are not allowed" },
  );

// ============================================================================
// Experience sub-schemas (RF04)
// ============================================================================

const experienceSchema = z
  .object({
    company: z
      .string()
      .trim()
      .min(2, "Company must have at least 2 characters")
      .max(150, "Company must be at most 150 characters"),

    role: z
      .string()
      .trim()
      .min(2, "Role must have at least 2 characters")
      .max(100, "Role must be at most 100 characters"),

    // Real calendar dates only ("2024-02-31" is rejected here, not by Postgres)
    startDate: calendarDateSchema("startDate"),

    // null = current experience (no end date)
    endDate: calendarDateSchema("endDate").nullable(),

    description: z
      .string()
      .trim()
      .max(2000, "Description must be at most 2000 characters")
      .nullable(),
  })
  .strict()
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: "endDate cannot be before startDate",
    path: ["endDate"],
  })
  .refine((data) => data.startDate <= new Date().toISOString().slice(0, 10), {
    message: "startDate cannot be in the future",
    path: ["startDate"],
  });

const experiencesSchema = z
  .array(experienceSchema)
  .max(20, "At most 20 experiences are allowed");

// ============================================================================
// Skill sub-schemas (RF04)
// ============================================================================

// "  react   js " -> "react js" (trim + collapse inner whitespace)
const skillSchema = z
  .string()
  .trim()
  .min(2, "Skill must have at least 2 characters")
  .max(50, "Skill must be at most 50 characters")
  .transform((value) => value.replace(/\s+/g, " "));

const skillsSchema = z
  .array(skillSchema)
  .max(30, "At most 30 skills are allowed")
  .refine(
    (list) => new Set(list.map((s) => s.toLowerCase())).size === list.length,
    { message: "Duplicate skills are not allowed" },
  );

// ============================================================================
// Certification sub-schemas (RF04)
// ============================================================================

const certificationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Certification name must have at least 2 characters")
      .max(150, "Certification name must be at most 150 characters"),

    issuer: z
      .string()
      .trim()
      .min(2, "Issuer must have at least 2 characters")
      .max(150, "Issuer must be at most 150 characters"),

    issuedAt: calendarDateSchema("issuedAt"),

    // null = does not expire
    expiresAt: calendarDateSchema("expiresAt").nullable(),

    credentialUrl: urlSchema,
  })
  .strict()
  .refine((data) => !data.expiresAt || data.expiresAt >= data.issuedAt, {
    message: "expiresAt cannot be before issuedAt",
    path: ["expiresAt"],
  })
  .refine((data) => data.issuedAt <= new Date().toISOString().slice(0, 10), {
    message: "issuedAt cannot be in the future",
    path: ["issuedAt"],
  });

const certificationsSchema = z
  .array(certificationSchema)
  .max(20, "At most 20 certifications are allowed");

// ============================================================================
// RF04 — Profile edit (partial PATCH)
// ============================================================================
//
// Deliberately outside this schema:
//   - cpf: correction only by an administrator (updateCpf / RF04)
//   - termsAcceptedAt / privacyAcceptedAt: consent is given at sign-up only
//   - password: changing it needs the current password / a reset flow, so it
//     belongs on its own route (e.g. PATCH /students/:id/password)
//
// PATCH semantics:
//   - field absent  → undefined → unchanged
//   - field = null  → clears the value (for nullable fields)
//   - field = value → updates

export const updateStudentSchema = z
  .object({
    // --- Basic fields ---
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    phones: phonesSchema.optional(),
    city: citySchema.optional(),
    educationLevel: educationLevelSchema.optional(),

    // RF13 / RN-C9: a mudança de visibilidade vale na hora. A trava de idade
    // para PUBLICO não pode ficar aqui — depende da data de nascimento já
    // gravada, que o validator não tem. Fica no service.
    visibility: visibilitySchema.optional(),

    // --- Professional profile ---
    bio: bioSchema.optional(),
    photoUrl: urlSchema.optional(),
    // RN-C10: https e domínio permitido.
    resumeUrl: resumeUrlSchema.optional(),
    linkedinUrl: urlSchema.optional(),
    portfolioUrl: urlSchema.optional(),

    // --- Multivalued lists ---
    languages: languagesSchema.optional(),
    experiences: experiencesSchema.optional(),
    skills: skillsSchema.optional(),
    certifications: certificationsSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
