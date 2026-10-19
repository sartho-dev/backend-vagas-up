import { z } from "zod";
import { passwordSchema } from "../../../shared/validators/passwordSchema";
import { isValidCnpj, isValidCpf } from "../../../shared/validators/documents";
import { AdvertiserType } from "../types/AdvertiserEnums";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("E-mail inválido"));

const nameSchema = z
  .string()
  .trim()
  .min(2, "O nome deve ter ao menos 2 caracteres")
  .max(150, "O nome deve ter no máximo 150 caracteres");

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\d{10,11}$/, "Telefone deve ter 10 ou 11 dígitos, sem pontuação");

// Só https: um "site" com javascript: viraria link clicável na página
// pública da empresa.
const siteSchema = z
  .string()
  .trim()
  .max(255)
  .refine((v) => v.startsWith("https://"), "O site deve começar com https://")
  .nullable()
  .default(null);

const documentSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "O documento deve conter apenas dígitos");

export const registerAdvertiserSchema = z
  .object({
    type: z.enum(AdvertiserType, { error: "Tipo inválido" }),
    document: documentSchema,
    displayName: nameSchema,
    legalName: nameSchema.nullable().default(null),
    contactEmail: emailSchema,
    contactPhone: phoneSchema,
    site: siteSchema,
    firstResponsible: z
      .object({
        name: nameSchema,
        email: emailSchema,
        password: passwordSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // O documento depende do tipo: CNPJ tem 14 dígitos, CPF tem 11, e cada
    // um tem seu cálculo de dígito verificador.
    const isCompany = data.type === AdvertiserType.COMPANY;
    const valid = isCompany
      ? isValidCnpj(data.document)
      : isValidCpf(data.document);

    if (!valid) {
      ctx.addIssue({
        code: "custom",
        path: ["document"],
        message: isCompany ? "CNPJ inválido" : "CPF inválido",
      });
    }

    // RF20: razão social é campo de PJ.
    if (isCompany && !data.legalName) {
      ctx.addIssue({
        code: "custom",
        path: ["legalName"],
        message: "Razão social é obrigatória para pessoa jurídica",
      });
    }
  });

// RF23: tipo e documento ficam de fora — são a identidade do anunciante e
// a base do selo de verificação.
export const updateAdvertiserSchema = z
  .object({
    displayName: nameSchema.optional(),
    legalName: nameSchema.nullable().optional(),
    contactEmail: emailSchema.optional(),
    contactPhone: phoneSchema.optional(),
    site: z
      .string()
      .trim()
      .max(255)
      .refine((v) => v.startsWith("https://"), "O site deve começar com https://")
      .nullable()
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo",
  });

// RF22
export const inviteResponsibleSchema = z
  .object({ email: emailSchema })
  .strict();

export const acceptInviteSchema = z
  .object({
    token: z.string().trim().min(20, "Token inválido").max(200, "Token inválido"),
    name: nameSchema,
    password: passwordSchema,
  })
  .strict();

export const responsibleIdParamSchema = z.object({
  id: z.uuid("Id de responsável inválido"),
});

export type RegisterAdvertiserInput = z.infer<typeof registerAdvertiserSchema>;
export type UpdateAdvertiserInput = z.infer<typeof updateAdvertiserSchema>;
export type InviteResponsibleInput = z.infer<typeof inviteResponsibleSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
