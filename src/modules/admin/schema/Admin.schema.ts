import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

// RF21 / RF22 / §6.3: administrator account.
// Place at: src/modules/admin/schema/Admin.schema.ts
// (the DataSource glob "modules/**/schema/*.{js,ts}" already picks it up)
@Entity("admins")
export class Admin {
  // RNF09: every primary key is a system-generated UUID
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "name", type: "varchar", length: 150 })
  name: string;

  // RN06: email is unique across students, responsibles and admins together.
  // The unique constraint here only covers this table; the cross-profile check
  // has to live in the service layer.
  @Column({ name: "email", type: "varchar", length: 255, unique: true })
  email: string;

  // RNF01: bcrypt (cost 12 minimum) or Argon2id, never plain text.
  // `select: false` keeps the hash out of ordinary queries; only the login
  // query asks for it explicitly.
  @Column({
    name: "password_hash",
    type: "varchar",
    length: 255,
    select: false,
  })
  passwordHash: string;

  // RF20 / RF21 / RNF08: deactivation instead of physical removal.
  // An admin may deactivate another admin, never themselves nor the last
  // active one (enforced in the service, inside a transaction).
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

  // RF21: who created this admin. NULL only for the first administrator,
  // created by the initial load script (§2.1).
  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdById: string | null;

  // RNF08: foreign keys are restricted at the database level, so an admin who
  // created others can never be physically deleted.
  @ManyToOne(() => Admin, {
    nullable: true,
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn({ name: "created_by" })
  createdBy: Admin | null;
}
