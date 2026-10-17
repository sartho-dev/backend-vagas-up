import { z } from "zod";
import { passwordSchema } from "../../../shared/validators/passwordSchema";

// Mesma normalização do login e do cadastro.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email("E-mail inválido"));

// O token é opaco: só o formato grosso é checado aqui. Validade, tipo e uso
// são conferidos no banco — não dá para inferir nada de um token bem formado.
const tokenSchema = z
  .string()
  .trim()
  .min(20, "Token inválido")
  .max(200, "Token inválido");

// RF01 / RN-A6
export const requestPasswordRecoverySchema = z
  .object({ email: emailSchema })
  .strict();

export const confirmPasswordRecoverySchema = z
  .object({
    token: tokenSchema,
    newPassword: passwordSchema,
  })
  .strict();

// RF03
export const requestEmailChangeSchema = z
  .object({ newEmail: emailSchema })
  .strict();

export const confirmEmailChangeSchema = z
  .object({ token: tokenSchema })
  .strict();

export type RequestPasswordRecoveryInput = z.infer<
  typeof requestPasswordRecoverySchema
>;
export type ConfirmPasswordRecoveryInput = z.infer<
  typeof confirmPasswordRecoverySchema
>;
export type RequestEmailChangeInput = z.infer<typeof requestEmailChangeSchema>;
export type ConfirmEmailChangeInput = z.infer<typeof confirmEmailChangeSchema>;
