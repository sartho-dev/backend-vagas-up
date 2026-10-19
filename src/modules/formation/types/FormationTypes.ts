import { EducationLevel } from "../../student/types/StudentEnums";
import { FormationStatus } from "./FormationEnums";

export type FormationResult = {
  id: string;
  level: EducationLevel;
  courseId: string | null;
  courseName: string | null;
  institution: string;
  status: FormationStatus;
  startDate: string;
  endDate: string | null;
};
