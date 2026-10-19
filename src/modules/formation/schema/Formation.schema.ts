import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Student } from "../../student/schema/Student.schema";
import { Course } from "../../course/schema/Course.schema";
import { EducationLevel } from "../../student/types/StudentEnums";
import { FormationStatus } from "../types/FormationEnums";

// RF11: "o candidato registra zero ou mais formações (nível, curso,
// instituição, situação, início e fim)".
//
// Zero é um estado válido: o cadastro (RF10) não exige nenhuma formação.
@Entity("formations")
@Index(["studentId"])
export class Formation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Student, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "student_id" })
  student: Student;

  @Column({ name: "student_id", type: "uuid" })
  studentId: string;

  // RN-C2: mesma lista da escolaridade do candidato.
  @Column({ name: "level", type: "enum", enum: EducationLevel })
  level: EducationLevel;

  // Opcional: nem toda formação tem curso do catálogo (ensino médio, por
  // exemplo). RESTRICT porque a RF33 proíbe excluir curso com vínculo — é
  // esta FK que o `hasLinks` do módulo de cursos passa a enxergar.
  @ManyToOne(() => Course, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "course_id" })
  course: Course | null;

  @Column({ name: "course_id", type: "uuid", nullable: true })
  courseId: string | null;

  // Texto livre: a v4.0 removeu a entidade Instituição do modelo.
  @Column({ name: "institution", type: "varchar", length: 150 })
  institution: string;

  @Column({ name: "status", type: "enum", enum: FormationStatus })
  status: FormationStatus;

  @Column({ name: "start_date", type: "date" })
  startDate: string;

  // Vazio enquanto a formação está em andamento.
  @Column({ name: "end_date", type: "date", nullable: true })
  endDate: string | null;

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt: Date;
}
