import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { StudentPhone } from "./StudentPhone.schema";
import { StudentLanguage } from "./StudentLanguage.schema";
import { StudentExperience } from "./StudentExperience.schema";
import { StudentSkill } from "./StudentSkill.schema";
import { StudentCertification } from "./StudentCertification.schema";

@Entity("students")
export class Student {
  // RNF09: every primary key is a system-generated UUID
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // RN06: CPF must be unique. Stored as 11 digits only, no punctuation.
  // RNF03: masking outside the student's own profile belongs to the
  // presentation layer, not to the entity.
  @Column({ name: "cpf", type: "char", length: 11, unique: true })
  cpf: string;

  @Column({ name: "name", type: "varchar", length: 150 })
  name: string;

  // RN06: email must be unique across all users
  @Column({ name: "email", type: "varchar", length: 255, unique: true })
  email: string;

  // RNF01: bcrypt (cost 12 minimum) or Argon2id — never plain text.
  // `select: false` keeps the hash out of ordinary queries.
  @Column({
    name: "password_hash",
    type: "varchar",
    length: 255,
    select: false,
  })
  passwordHash: string;

  @Column({ name: "birth_date", type: "date" })
  birthDate: string;

  @Column({ name: "bio", type: "text", nullable: true })
  bio: string | null;

  @Column({
    name: "linkedin_url",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  linkedinUrl: string | null;

  @Column({
    name: "portfolio_url",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  portfolioUrl: string | null;

  // RF10 / RNF08: soft delete instead of physical removal
  // RN-A4: contador de falhas seguidas de login e, ao atingir o limite,
  // o instante até o qual o login fica bloqueado. Ficam na conta (e não em
  // tabela própria) como manda a seção 6 do SRS.
  @Column({ name: "failed_logins", type: "int", default: 0 })
  failedLogins: number;

  @Column({ name: "blocked_until", type: "timestamptz", nullable: true })
  blockedUntil: Date | null;

  @Column({ name: "active", type: "boolean", default: true })
  active: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  // RF03 / RNF03: signing up requires accepting the terms of use and the
  // privacy policy, and the LGPD requires that consent to be recorded.
  @Column({ name: "terms_accepted_at", type: "timestamptz" })
  termsAcceptedAt: Date;

  @Column({ name: "privacy_accepted_at", type: "timestamptz" })
  privacyAcceptedAt: Date;

  // RF03: one or more phone numbers (multivalued attribute in the ERD)
  @OneToMany(() => StudentPhone, (phone) => phone.student, {
    cascade: ["insert", "update"],
  })
  phones: StudentPhone[];

  @OneToMany(() => StudentLanguage, (language) => language.student, {
    cascade: ["insert", "update"],
  })
  languages: StudentLanguage[];

  @OneToMany(() => StudentExperience, (experience) => experience.student, {
    cascade: ["insert", "update"],
  })
  experiences: StudentExperience[];

  @OneToMany(() => StudentSkill, (skill) => skill.student, {
    cascade: ["insert", "update"],
  })
  skills: StudentSkill[];

  @OneToMany(
    () => StudentCertification,
    (certification) => certification.student,
    {
      cascade: ["insert", "update"],
    },
  )
  certifications: StudentCertification[];
}
