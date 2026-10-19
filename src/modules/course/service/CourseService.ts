import { AppError } from "../../../shared/errors/AppError";
import { ICourseRepository } from "../interfaces/ICourseRepository";
import { Course } from "../schema/Course.schema";
import { CourseResult } from "../types/CourseTypes";

function toCourseResult(course: Course): CourseResult {
  return { id: course.id, name: course.name };
}

export class CourseService {
  constructor(private repository: ICourseRepository) {}

  // RF33
  async createService(name: string): Promise<CourseResult> {
    const course = await this.repository.create(name);

    return toCourseResult(course);
  }

  async listService(): Promise<CourseResult[]> {
    const courses = await this.repository.list();

    return courses.map(toCourseResult);
  }

  async renameService(id: string, name: string): Promise<CourseResult> {
    const course = await this.repository.rename(id, name);

    if (!course) {
      throw new AppError("Curso não encontrado", 404);
    }

    return toCourseResult(course);
  }

  // RF33: curso com vínculo não sai.
  async deleteService(id: string): Promise<void> {
    const outcome = await this.repository.delete(id);

    if (outcome === "not_found") {
      throw new AppError("Curso não encontrado", 404);
    }

    if (outcome === "has_links") {
      throw new AppError(
        "Curso com formações ou vagas vinculadas não pode ser excluído",
        409,
      );
    }
  }
}
