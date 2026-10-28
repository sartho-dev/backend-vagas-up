import { z } from "zod";
import { AppError } from "../../../shared/errors/AppError";
import { VacancyType } from "../../../shared/types/VacancyType";
import { EducationLevel } from "../../student/types/StudentEnums";
import {
  VACANCY_VALIDITY_DAYS,
  VacancyModality,
  WORK_HOURS_LIMIT,
  WORK_HOURS_UNIT,
} from "../types/VacancyEnums";

// RF14 + RNF04: 20 por página, fixo.
export const PUBLIC_SEARCH_PAGE_SIZE = 20;

// `multipleOf(0.5)`: meia hora existe numa jornada, quinze minutos não.
const workHoursSchema = z
  .number({ error: "Carga horária é obrigatória" })
  .positive("A carga horária deve ser maior que zero")
  .max(44, "A carga horária é alta demais")
  .multipleOf(0.5, "A carga horária vai de meia em meia hora");

const vacancyFields = {
  type: z.enum(VacancyType, { error: "Tipo de vaga inválido" }),
  title: z
    .string()
    .trim()
    .min(5, "O título deve ter ao menos 5 caracteres")
    .max(150, "O título deve ter no máximo 150 caracteres"),
  description: z
    .string()
    .trim()
    .min(20, "A descrição deve ter ao menos 20 caracteres")
    .max(5000, "A descrição deve ter no máximo 5000 caracteres"),
  modality: z.enum(VacancyModality, { error: "Modalidade inválida" }),
  city: z
    .string()
    .trim()
    .min(2, "Informe a cidade")
    .max(100, "A cidade deve ter no máximo 100 caracteres"),
  workHours: workHoursSchema,
  minEducation: z.enum(EducationLevel, {
    error: "Escolaridade mínima inválida",
  }),
  // RN-VG9: a marca só existe porque a lei proíbe menores em certos
  // trabalhos (noturno, perigoso, insalubre). Qualquer outro campo de
  // idade é recusado pelo `.strict()` — anúncio com faixa de idade é
  // prática discriminatória (Lei 9.029/1995).
  requiresAdult: z.boolean().default(false),
  positions: z
    .number()
    .int("O número de posições deve ser inteiro")
    .min(1, "A vaga precisa de ao menos uma posição")
    .max(99, "São no máximo 99 posições na mesma vaga")
    .default(1),
  courseId: z.uuid("Curso inválido").nullable().default(null),
  requirements: z.string().trim().max(2000).nullable().default(null),
  benefits: z.string().trim().max(2000).nullable().default(null),
  // Texto livre: "a combinar" é resposta legítima da RF24.
  compensation: z.string().trim().max(100).nullable().default(null),
  schedule: z.string().trim().max(100).nullable().default(null),
  // RN-VG3: opcional. As regras de data dependem do momento da
  // publicação, então ficam em assertDeadlineWithinValidity.
  deadline: z.coerce.date({ error: "Prazo inválido" }).nullable().default(null),
};

export const createVacancySchema = z.object(vacancyFields).strict();

// A edição manda só o que muda. O `.strict()` continua valendo: um PATCH
// com `situation`, `value` ou `free` é 400, não uma publicação silenciosa.
export const patchVacancySchema = z
  .object(vacancyFields)
  .partial()
  .strict()
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Informe ao menos um campo para alterar",
  );

export const vacancyIdParamSchema = z.object({
  id: z.uuid("Vaga inválida"),
});

// RF29: a revisão com dupla confirmação. O backend não desenha tela, mas
// também não publica sem o segundo "sim" — sem este campo, um POST
// acidental na rota publicaria a vaga. É o que torna a confirmação uma
// regra do sistema e não um detalhe do front.
export const submitVacancySchema = z
  .object({
    confirmed: z.literal(true, {
      error: "Confirme a revisão da vaga antes de enviá-la",
    }),
  })
  .strict();

// RN-VG4: o limite depende do tipo E da unidade. Estágio e emprego são
// limites SEMANAIS; jovem aprendiz é DIÁRIO (CLT art. 432). A mensagem diz
// a unidade porque "máximo 6 h" sozinho confundiria quem acha que são
// semanais.
export function assertWorkHoursWithinLimit(
  type: VacancyType,
  workHours: number,
): void {
  const limit = WORK_HOURS_LIMIT[type];

  if (workHours > limit) {
    const unit = WORK_HOURS_UNIT[type] === "diaria" ? "diárias" : "semanais";

    throw new AppError(
      `A carga horária máxima para este tipo de vaga é de ${limit} h ${unit}`,
      400,
    );
  }
}

// RN-VG3: o prazo não pode ser anterior à publicação nem passar dos 60
// dias de validade (RN-P4).
//
// A referência é o momento do ENVIO, não o da publicação: numa vaga paga a
// publicação só acontece quando o admin confirma o PIX, dias depois, e
// ninguém pode preencher um prazo contra uma data que ainda não existe.
// Isso é seguro para a regra: `expires_at` é `published_at + 60 dias`, e
// `published_at >= envio`, então um prazo dentro de 60 dias do envio cai
// sempre dentro da validade da vaga.
export function assertDeadlineWithinValidity(
  deadline: Date | null,
  now: Date,
): void {
  if (!deadline) return;

  if (deadline.getTime() <= now.getTime()) {
    throw new AppError("O prazo não pode ser anterior à publicação", 400);
  }

  const limit = new Date(now);
  limit.setUTCDate(limit.getUTCDate() + VACANCY_VALIDITY_DAYS);

  if (deadline.getTime() > limit.getTime()) {
    throw new AppError(
      `O prazo não pode passar dos ${VACANCY_VALIDITY_DAYS} dias de validade da vaga`,
      400,
    );
  }
}

export type CreateVacancyInput = z.infer<typeof createVacancySchema>;
export type PatchVacancyInput = z.infer<typeof patchVacancySchema>;

// RF14: os filtros da busca pública. Todos opcionais e combináveis.
//
// `.strict()` fora de propósito aqui: a RF43 (task 26) vai colar
// `?origem=instagram` nos links divulgados, e um `.strict()` faria todo
// link compartilhado no Instagram responder 400.
export const searchVacanciesQuerySchema = z.object({
  type: z.enum(VacancyType).optional(),
  modality: z.enum(VacancyModality).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  minEducation: z.enum(EducationLevel).optional(),
  courseId: z.uuid("Curso inválido").optional(),
  // Texto que a pessoa digitou. O `websearch_to_tsquery` do Postgres aceita
  // o que vier, então não há sintaxe a validar — só tamanho, para não
  // mandar um romance ao banco.
  keyword: z.string().trim().min(2).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  // RF14 + RNF04: 20 por página. O limite é fixo e não vem da URL: os 2 s
  // da RNF04 foram medidos para 20, e `?limit=5000` seria o caminho mais
  // curto para derrubar a busca.
});

export const vacancySlugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(180)
    // Só o que o gerador de slug produz. Um slug com outros caracteres não
    // existe no banco, e barrar aqui evita levar lixo até a consulta.
    .regex(/^[a-z0-9-]+$/, "Endereço inválido"),
});

export type SearchVacanciesQuery = z.infer<typeof searchVacanciesQuerySchema>;
