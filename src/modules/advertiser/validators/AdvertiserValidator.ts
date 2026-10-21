import { z } from "zod";
import { passwordSchema } from "../../../shared/validators/passwordSchema";
import { isValidCnpj, isValidCpf } from "../../../shared/validators/documents";
import { AdvertiserType, VerificationMethod } from "../types/AdvertiserEnums";

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
      .refine(
        (v) => v.startsWith("https://"),
        "O site deve começar com https://",
      )
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
    token: z
      .string()
      .trim()
      .min(20, "Token inválido")
      .max(200, "Token inválido"),
    name: nameSchema,
    password: passwordSchema,
  })
  .strict();

export const responsibleIdParamSchema = z.object({
  id: z.uuid("Id de responsável inválido"),
});

export const advertiserIdParamSchema = z.object({
  id: z.uuid("Id de anunciante inválido"),
});

export const listVerificationQueueSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

// Decisão binária: sem "verify" não há método; sem "reject" não há motivo.
// O discriminatedUnion força que só um dos dois apareça — um admin tentando
// mandar { decision: "verify", reason: "..." } recebe 400 do Zod, não uma
// decisão gravada com motivo órfão.
export const decideVerificationSchema = z.discriminatedUnion("decision", [
  z
    .object({
      decision: z.literal("verify"),
      method: z.enum(VerificationMethod, {
        error: "Informe um método de verificação válido",
      }),
    })
    .strict(),
  z
    .object({
      decision: z.literal("reject"),
      // A mensagem de ausência vem junto: sem ela o Zod responde em inglês,
      // e a recusa sem motivo é justamente o erro que o admin mais comete.
      reason: z
        .string({ error: "Motivo é obrigatório" })
        .trim()
        .min(1, "Motivo é obrigatório")
        .max(1000, "Motivo deve ter no máximo 1000 caracteres"),
    })
    .strict(),
]);

export type DecideVerificationInput = z.infer<typeof decideVerificationSchema>;

export type RegisterAdvertiserInput = z.infer<typeof registerAdvertiserSchema>;
export type UpdateAdvertiserInput = z.infer<typeof updateAdvertiserSchema>;
export type InviteResponsibleInput = z.infer<typeof inviteResponsibleSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
