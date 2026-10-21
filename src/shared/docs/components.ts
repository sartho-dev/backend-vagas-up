import { z } from "zod";
import { createStudentSchema } from "../../modules/student/validators/CreateStudentValidator";
import {
  changePasswordSchema,
  updateStudentSchema,
} from "../../modules/student/validators/UpdateStudentValidator";
import { loginSchema } from "../../modules/auth/validators/LoginValidator";
import {
  confirmEmailChangeSchema,
  confirmPasswordRecoverySchema,
  requestEmailChangeSchema,
  requestPasswordRecoverySchema,
} from "../../modules/auth/validators/RecoveryValidator";
import {
  createCourseSchema,
  updateCourseSchema,
} from "../../modules/course/validators/CourseValidator";
import {
  createFormationSchema,
  updateFormationSchema,
} from "../../modules/formation/validators/FormationValidator";
import {
  updateSettingSchema,
  updateVacancyPriceSchema,
} from "../../modules/pricing/validators/PricingValidator";
import {
  createAdminSchema,
  updateOwnProfileSchema,
} from "../../modules/admin/validators/adminValidator";
import {
  acceptInviteSchema,
  inviteResponsibleSchema,
  registerAdvertiserSchema,
  updateAdvertiserSchema,
} from "../../modules/advertiser/validators/AdvertiserValidator";
import {
  createVacancySchema,
  patchVacancySchema,
  submitVacancySchema,
} from "../../modules/vacancy/validators/VacancyValidator";

// Os corpos de requisição são GERADOS dos mesmos schemas Zod que validam.
//
// Documentação escrita à mão mente em silêncio: alguém muda o validator, o
// comentário fica para trás e o front confia no que está errado. Gerando da
// mesma fonte, a divergência deixa de ser possível.
//
// O que o Zod não sabe — caminho, método, respostas de erro, quem precisa de
// token — continua declarado à mão nas anotações de cada rota.
const requestSchemas = {
  // auth
  Login: loginSchema,
  RequestPasswordRecovery: requestPasswordRecoverySchema,
  ConfirmPasswordRecovery: confirmPasswordRecoverySchema,
  RequestEmailChange: requestEmailChangeSchema,
  ConfirmEmailChange: confirmEmailChangeSchema,

  // candidato
  CreateStudent: createStudentSchema,
  UpdateStudent: updateStudentSchema,
  ChangePassword: changePasswordSchema,

  // formações
  CreateFormation: createFormationSchema,
  UpdateFormation: updateFormationSchema,

  // cursos
  CreateCourse: createCourseSchema,
  UpdateCourse: updateCourseSchema,

  // anunciante
  RegisterAdvertiser: registerAdvertiserSchema,
  UpdateAdvertiser: updateAdvertiserSchema,
  InviteResponsible: inviteResponsibleSchema,
  AcceptInvite: acceptInviteSchema,

  // vagas
  CreateVacancy: createVacancySchema,
  PatchVacancy: patchVacancySchema,
  SubmitVacancy: submitVacancySchema,

  // preços e configuração
  UpdateVacancyPrice: updateVacancyPriceSchema,
  UpdateSetting: updateSettingSchema,

  // administração
  CreateAdmin: createAdminSchema,
  UpdateOwnAdminProfile: updateOwnProfileSchema,
} satisfies Record<string, z.ZodType>;

export type RequestSchemaName = keyof typeof requestSchemas;

function toOpenApi(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, {
    target: "openapi-3.0",
    // Alguns schemas têm `.refine`/`.superRefine`, que não têm equivalente
    // em JSON Schema. Em vez de quebrar a geração, o campo sai sem a regra
    // extra — ela continua valendo na validação, só não aparece no Swagger.
    io: "input",
    unrepresentable: "any",
  }) as Record<string, unknown>;
}

export const generatedSchemas = Object.fromEntries(
  Object.entries(requestSchemas).map(([name, schema]) => [
    name,
    toOpenApi(schema),
  ]),
);

// Toda resposta de erro do projeto passa pelo errorHandler e tem este
// formato. Declarado uma vez e referenciado por todas as rotas.
export const errorSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["error"] },
    message: { type: "string" },
  },
  required: ["status", "message"],
};

export const commonResponses = {
  BadRequest: {
    description: "Dados inválidos",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    },
  },
  Unauthorized: {
    description: "Sem token, token inválido ou sessão expirada",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    },
  },
  Forbidden: {
    description: "Token válido, mas de um perfil que não pode acessar",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    },
  },
  NotFound: {
    description: "Recurso não encontrado",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    },
  },
  Conflict: {
    description: "Conflito com o estado atual (duplicidade, regra de negócio)",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    },
  },
};
