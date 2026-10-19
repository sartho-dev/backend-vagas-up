import { Course } from "../schema/Course.schema";
import { DeleteCourseOutcome } from "../types/CourseTypes";

export interface ICourseRepository {
  // RF33. Lança AppError 409 se o banco recusar nome duplicado (23505).
  create(name: string): Promise<Course>;

  // Liberado para visitante, candidato, responsável e admin: a RF11
  // (formações) e a RF24 (vagas) precisam da lista.
  list(): Promise<Course[]>;

  findById(id: string): Promise<Course | null>;

  // Mesmo tratamento de duplicidade do create.
  rename(id: string, name: string): Promise<Course | null>;

  // RF33: só sai quem não tem vínculo. O repositório decide em transação
  // para a checagem e a exclusão não serem separadas por uma janela.
  delete(id: string): Promise<DeleteCourseOutcome>;

  // Gancho para as tasks 09 e 13. Isolado de propósito: quando `formations`
  // e `vacancies` existirem, muda só este método.
  hasLinks(id: string): Promise<boolean>;
}
