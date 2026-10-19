import { EntityManager, Repository } from "typeorm";
import { Course } from "../schema/Course.schema";
import { ICourseRepository } from "../interfaces/ICourseRepository";
import { DeleteCourseOutcome } from "../types/CourseTypes";
import { AppError } from "../../../shared/errors/AppError";

// 23505 = unique_violation. Traduz a constraint do banco na mesma resposta
// que a checagem prévia do service daria, para a corrida entre duas
// requisições simultâneas não virar 500.
function rethrowDuplicateName(error: unknown): never {
  if ((error as { code?: string })?.code === "23505") {
    throw new AppError("Já existe um curso com esse nome", 409);
  }
  throw error;
}

export class CourseRepository implements ICourseRepository {
  constructor(private repository: Repository<Course>) {}

  async create(name: string): Promise<Course> {
    try {
      return await this.repository.save(this.repository.create({ name }));
    } catch (error) {
      rethrowDuplicateName(error);
    }
  }

  async list(): Promise<Course[]> {
    return await this.repository.find({ order: { name: "ASC" } });
  }

  async findById(id: string): Promise<Course | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async rename(id: string, name: string): Promise<Course | null> {
    try {
      const result = await this.repository.update({ id }, { name });
      if (result.affected === 0) return null;

      return await this.findById(id);
    } catch (error) {
      rethrowDuplicateName(error);
    }
  }

  async delete(id: string): Promise<DeleteCourseOutcome> {
    return await this.repository.manager.transaction(async (tm) => {
      // Trava a linha: sem isso, um vínculo criado entre a checagem e o
      // DELETE deixaria uma formação apontando para um curso que sumiu.
      const course = await tm.findOne(Course, {
        where: { id },
        lock: { mode: "pessimistic_write" },
      });

      if (!course) return "not_found";
      if (await this.hasLinksWith(tm, id)) return "has_links";

      await tm.delete(Course, { id });

      return "deleted";
    });
  }

  async hasLinks(id: string): Promise<boolean> {
    return await this.hasLinksWith(this.repository.manager, id);
  }

  // TASK 09: passa a consultar `formations` (RF11).
  // TASK 13: passa a consultar `vacancies` (RF24).
  //
  // Enquanto essas tabelas não existem, não há vínculo possível. O método
  // recebe o EntityManager para rodar DENTRO da transação do delete quando
  // chamado por ele — senão a trava da linha não protegeria nada.
  private async hasLinksWith(
    _manager: EntityManager,
    _id: string,
  ): Promise<boolean> {
    return false;
  }
}
