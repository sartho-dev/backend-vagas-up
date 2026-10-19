import { z } from "zod";
import { calendarDateSchema } from "../../student/validators/CreateStudentValidator";
import { EducationLevel } from "../../student/types/StudentEnums";
import { FormationStatus } from "../types/FormationEnums";

const levelSchema = z.enum(EducationLevel, { error: "Nível inválido" });
const statusSchema = z.enum(FormationStatus, { error: "Situação inválida" });

const institutionSchema = z
  .string()
  .trim()
  .min(2, "A instituição deve ter ao menos 2 caracteres")
  .max(150, "A instituição deve ter no máximo 150 caracteres");

const formationFields = {
  level: levelSchema,
  courseId: z.uuid("Id de curso inválido").nullable().default(null),
  institution: institutionSchema,
  status: statusSchema,
  startDate: calendarDateSchema("startDate"),
  endDate: calendarDateSchema("endDate").nullable().default(null),
};

// As duas regras de data da RF11, aplicadas no mesmo lugar porque ambas
// dependem de mais de um campo.
function checkDates(
  data: { status: FormationStatus; startDate: string; endDate: string | null },
  ctx: z.RefinementCtx,
): void {
  // "fim, quando informado, não pode ser anterior ao início"
  if (data.endDate !== null && data.endDate < data.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "A data de fim não pode ser anterior à de início",
    });
  }

  // "fica vazio enquanto a formação está em andamento". Sem isso, uma
  // formação em andamento com data de fim passada passaria a valer para a
  // RN-C4 (vaga de estágio) sem corresponder à realidade.
  if (data.status === FormationStatus.IN_PROGRESS && data.endDate !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "Formação em andamento não pode ter data de fim",
    });
  }
}

// Comparação de strings "YYYY-MM-DD" funciona lexicograficamente — por isso
// o formato é validado antes, pelo calendarDateSchema.
export const createFormationSchema = z
  .object(formationFields)
  .strict()
  .superRefine(checkDates);

// Na edição tudo é opcional, mas as regras de data precisam do registro
// inteiro: o service mescla o que veio com o que está gravado e revalida.
export const updateFormationSchema = z
  .object({
    level: levelSchema.optional(),
    courseId: z.uuid("Id de curso inválido").nullable().optional(),
    institution: institutionSchema.optional(),
    status: statusSchema.optional(),
    startDate: calendarDateSchema("startDate").optional(),
    endDate: calendarDateSchema("endDate").nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo",
  });

export const formationIdParamSchema = z.object({
  id: z.uuid("Id de formação inválido"),
});

// Usado pelo service depois de mesclar com o que está no banco.
export const mergedFormationDatesSchema = z
  .object({
    status: statusSchema,
    startDate: calendarDateSchema("startDate"),
    endDate: calendarDateSchema("endDate").nullable(),
  })
  .superRefine(checkDates);

export type CreateFormationInput = z.infer<typeof createFormationSchema>;
export type UpdateFormationInput = z.infer<typeof updateFormationSchema>;
