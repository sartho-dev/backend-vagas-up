import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Student } from "./Student.schema";

// Section 6.2: phone numbers are multivalued in the ERD and therefore live
// in their own table.
@Entity("student_phones")
export class StudentPhone {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "number", type: "varchar", length: 20 })
  number: string;

  // RN-C11: "este número tem WhatsApp". Como a tabela de telefones foi
  // mantida (divergência registrada no TASKS.md), a marca fica POR TELEFONE
  // e não por pessoa como no modelo da v4.9 — alguém pode ter um fixo e um
  // celular, e só um deles ter WhatsApp.
  @Column({ name: "is_whatsapp", type: "boolean", default: false })
  isWhatsapp: boolean;

  // RNF08: every foreign key is constrained at the database level.
  // The column name below must stay in sync with the @Column("student_id")
  // declaration — if they diverge, TypeORM silently creates two columns.
  @ManyToOne(() => Student, (student) => student.phones, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "student_id" })
  student: Student;

  @Column({ name: "student_id", type: "uuid" })
  studentId: string;
}
