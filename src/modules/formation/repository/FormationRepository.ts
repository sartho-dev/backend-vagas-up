import { Repository } from "typeorm";
import { Formation } from "../schema/Formation.schema";
import {
  FormationData,
  IFormationRepository,
} from "../interfaces/IFormationRepository";
import { FormationStatus } from "../types/FormationEnums";
import { AppError } from "../../../shared/errors/AppError";

// 23503 = foreign_key_violation. Um courseId que não existe é erro de quem
// chamou (400), não falha do servidor.
function rethrowMissingCourse(error: unknown): never {
  if ((error as { code?: string })?.code === "23503") {
    throw new AppError("Curso não encontrado", 400);
  }
  throw error;
}

export class FormationRepository implements IFormationRepository {
  constructor(private repository: Repository<Formation>) {}

  async listByStudent(studentId: string): Promise<Formation[]> {
    return await this.repository.find({
      where: { studentId },
      relations: { course: true },
      order: { startDate: "DESC" },
    });
  }

  async findOwned(id: string, studentId: string): Promise<Formation | null> {
    return await this.repository.findOne({
      where: { id, studentId },
      relations: { course: true },
    });
  }

  async create(studentId: string, data: FormationData): Promise<Formation> {
    try {
      const saved = await this.repository.save(
        this.repository.create({ studentId, ...data }),
      );

      // Relê para trazer o curso junto, que o mapper usa para o nome.
      return (await this.findOwned(saved.id, studentId)) ?? saved;
    } catch (error) {
      rethrowMissingCourse(error);
    }
  }

  async update(
    id: string,
    studentId: string,
    data: Partial<FormationData>,
  ): Promise<boolean> {
    try {
      // O studentId entra no WHERE: a formação de outro candidato
      // simplesmente não é alcançada.
      const result = await this.repository.update({ id, studentId }, data);

      return (result.affected ?? 0) > 0;
    } catch (error) {
      rethrowMissingCourse(error);
    }
  }

  async delete(id: string, studentId: string): Promise<boolean> {
    const result = await this.repository.delete({ id, studentId });

    return (result.affected ?? 0) > 0;
  }

  async hasInProgress(
    studentId: string,
    courseId?: string | null,
  ): Promise<boolean> {
    return await this.repository.exists({
      where: {
        studentId,
        status: FormationStatus.IN_PROGRESS,
        ...(courseId ? { courseId } : {}),
      },
    });
  }
}
