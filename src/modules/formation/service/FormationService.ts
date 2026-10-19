import { AppError } from "../../../shared/errors/AppError";
import { IFormationRepository } from "../interfaces/IFormationRepository";
import { Formation } from "../schema/Formation.schema";
import { FormationResult } from "../types/FormationTypes";
import {
  CreateFormationInput,
  UpdateFormationInput,
  mergedFormationDatesSchema,
} from "../validators/FormationValidator";

function toFormationResult(formation: Formation): FormationResult {
  return {
    id: formation.id,
    level: formation.level,
    courseId: formation.courseId,
    courseName: formation.course?.name ?? null,
    institution: formation.institution,
    status: formation.status,
    startDate: formation.startDate,
    endDate: formation.endDate,
  };
}

const NOT_FOUND = "Formação não encontrada";

export class FormationService {
  constructor(private repository: IFormationRepository) {}

  async listService(studentId: string): Promise<FormationResult[]> {
    const formations = await this.repository.listByStudent(studentId);

    return formations.map(toFormationResult);
  }

  async createService(
    studentId: string,
    data: CreateFormationInput,
  ): Promise<FormationResult> {
    const formation = await this.repository.create(studentId, data);

    return toFormationResult(formation);
  }

  async updateService(
    studentId: string,
    id: string,
    data: UpdateFormationInput,
  ): Promise<FormationResult> {
    const current = await this.repository.findOwned(id, studentId);

    // 404 e não 403: a formação de outro candidato não é "proibida", ela
    // não existe dentro do escopo /me. Responder 403 confirmaria que aquele
    // id existe em algum lugar.
    if (!current) {
      throw new AppError(NOT_FOUND, 404);
    }

    // As regras de data olham o registro INTEIRO. Numa edição parcial, o que
    // não veio tem de ser lido do banco — senão trocar só a situação para
    // "em andamento" deixaria uma data de fim antiga para trás.
    const merged = mergedFormationDatesSchema.safeParse({
      status: data.status ?? current.status,
      startDate: data.startDate ?? current.startDate,
      endDate: data.endDate !== undefined ? data.endDate : current.endDate,
    });

    if (!merged.success) {
      throw new AppError(merged.error.issues[0].message, 400);
    }

    await this.repository.update(id, studentId, data);

    const updated = await this.repository.findOwned(id, studentId);
    if (!updated) throw new AppError(NOT_FOUND, 404);

    return toFormationResult(updated);
  }

  async deleteService(studentId: string, id: string): Promise<void> {
    const removed = await this.repository.delete(id, studentId);

    if (!removed) {
      throw new AppError(NOT_FOUND, 404);
    }
  }
}
