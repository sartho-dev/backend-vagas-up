import { EducationLevel } from "../../student/types/StudentEnums";
import { VacancyType } from "../../../shared/types/VacancyType";
import { VacancyModality, VacancySituation } from "../types/VacancyEnums";

// Campos que o anunciante preenche (RF24). Os mesmos no cadastro e na
// edição — a edição só muda quem pode chamá-la (RN-P5).
export type VacancyInput = {
  type: VacancyType;
  title: string;
  description: string;
  modality: VacancyModality;
  city: string;
  workHours: number;
  minEducation: EducationLevel;
  requiresAdult: boolean;
  positions: number;
  courseId: string | null;
  requirements: string | null;
  benefits: string | null;
  compensation: string | null;
  schedule: string | null;
  deadline: Date | null;
};

// A edição manda só o que muda.
export type VacancyPatch = Partial<VacancyInput>;

// O que as rotas do responsável devolvem. `workHoursUnit` vai junto porque
// o número sozinho é ambíguo: 6 significa 6 h diárias num jovem aprendiz e
// 6 h semanais em nada (RN-VG4).
export type VacancyResult = {
  id: string;
  advertiserId: string;
  createdBy: string;
  type: VacancyType;
  title: string;
  description: string;
  modality: VacancyModality;
  city: string;
  workHours: number;
  workHoursUnit: "semanal" | "diaria";
  minEducation: EducationLevel;
  requiresAdult: boolean;
  positions: number;
  courseId: string | null;
  requirements: string | null;
  benefits: string | null;
  compensation: string | null;
  schedule: string | null;
  deadline: Date | null;
  situation: VacancySituation;
  free: boolean;
  value: number | null;
  referenceCode: string;
  publishedAt: Date | null;
  expiresAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
};
