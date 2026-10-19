import { z } from "zod";

// Trim obrigatório: " Administração" e "Administração" são o mesmo curso, e
// sem isso a constraint de unicidade deixaria os dois entrarem.
export const courseNameSchema = z
  .string()
  .trim()
  .min(2, "O nome do curso deve ter ao menos 2 caracteres")
  .max(120, "O nome do curso deve ter no máximo 120 caracteres");

export const createCourseSchema = z.object({ name: courseNameSchema }).strict();

export const updateCourseSchema = z.object({ name: courseNameSchema }).strict();

export const courseIdParamSchema = z.object({
  id: z.uuid("Id de curso inválido"),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
