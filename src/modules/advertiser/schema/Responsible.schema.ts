import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Advertiser } from "./Advertiser.schema";

// RF20/RF22: pessoa que entra no sistema em nome de um anunciante. Um
// anunciante pode ter vários (dono e RH, por exemplo); cada responsável
// pertence a um único anunciante.
//
// É a TERCEIRA tabela de conta do projeto, ao lado de `students` e
// `admins` — decisão D1, registrada no TASKS.md: os perfis seguem
// separados, com o EmailRegistry garantindo e-mail único entre eles.
@Entity("responsibles")
@Index(["advertiserId"])
export class Responsible {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // RESTRICT e não CASCADE: anunciante com responsável não é apagado, é
  // desativado (RNF06).
  @ManyToOne(() => Advertiser, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "advertiser_id" })
  advertiser: Advertiser;

  @Column({ name: "advertiser_id", type: "uuid" })
  advertiserId: string;

  @Column({ name: "name", type: "varchar", length: 150 })
  name: string;

  // RN-A7: único aqui e, via EmailRegistry, entre todos os perfis.
  @Column({ name: "email", type: "varchar", length: 255, unique: true })
  email: string;

  @Column({
    name: "password_hash",
    type: "varchar",
    length: 255,
    select: false,
  })
  passwordHash: string;

  @Column({ name: "active", type: "boolean", default: true })
  active: boolean;

  // RN-A4: mesmo bloqueio por tentativas dos outros perfis.
  @Column({ name: "failed_logins", type: "int", default: 0 })
  failedLogins: number;

  @Column({ name: "blocked_until", type: "timestamptz", nullable: true })
  blockedUntil: Date | null;

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt: Date;
}
