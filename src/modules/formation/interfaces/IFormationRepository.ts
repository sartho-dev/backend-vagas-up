import { Formation } from "../schema/Formation.schema";
import { EducationLevel } from "../../student/types/StudentEnums";
import { FormationStatus } from "../types/FormationEnums";

export type FormationData = {
  level: EducationLevel;
  courseId: string | null;
  institution: string;
  status: FormationStatus;
  startDate: string;
  endDate: string | null;
};

export interface IFormationRepository {
  // Todas as consultas levam o studentId: a posse é filtro de banco, não
  // checagem no service. Assim nenhuma rota nova consegue, por esquecimento,
  // alcançar a formação de outro candidato.
  listByStudent(studentId: string): Promise<Formation[]>;
  findOwned(id: string, studentId: string): Promise<Formation | null>;

  create(studentId: string, data: FormationData): Promise<Formation>;
  update(
    id: string,
    studentId: string,
    data: Partial<FormationData>,
  ): Promise<boolean>;
  delete(id: string, studentId: string): Promise<boolean>;

  // RN-C4 (task 16): a vaga de estágio exige formação EM ANDAMENTO, e no
  // curso da vaga quando ela indica um.
  hasInProgress(studentId: string, courseId?: string | null): Promise<boolean>;
}
