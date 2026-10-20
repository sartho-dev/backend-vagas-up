import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Admin } from "../../admin/schema/Admin.schema";
import {
  AdvertiserType,
  VerificationMethod,
  VerificationStatus,
} from "../types/AdvertiserEnums";

@Entity("advertisers")
export class Advertiser {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "type", type: "enum", enum: AdvertiserType })
  type: AdvertiserType;

  // CNPJ (14) ou CPF (11), só dígitos. Único no banco: é o que impede a
  // mesma empresa de ter dois cadastros e burlar a vaga gratuita (RN-P1).
  @Column({ name: "document", type: "varchar", length: 14, unique: true })
  cnpj: string;

  @Column({ name: "display_name", type: "varchar", length: 150 })
  displayName: string;

  // Só PJ tem razão social.
  @Column({ name: "legal_name", type: "varchar", length: 150, nullable: true })
  legalName: string | null;

  @Column({ name: "contact_email", type: "varchar", length: 255 })
  contactEmail: string;

  @Column({ name: "contact_phone", type: "varchar", length: 20 })
  contactPhone: string;

  @Column({ name: "site", type: "varchar", length: 255, nullable: true })
  site: string | null;

  @Column({
    name: "verification",
    type: "enum",
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verification: VerificationStatus;

  // Quando o pedido de verificação foi feito (RF21). Sem ele não dá para
  // medir o tempo de fila — o selo "Verificado" só vale enquanto a fila anda.
  @Column({
    name: "verification_requested_at",
    type: "timestamptz",
    nullable: true,
  })
  verificationRequestedAt: Date | null;

  // RNF07: quem decidiu. FK para admins. Admin não é apagado, é desativado
  // (RF34), então ON DELETE RESTRICT — mesma regra do RNF06 para qualquer FK.
  @ManyToOne(() => Admin, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "verified_by" })
  verifiedByAdmin: Admin | null;

  @Column({ name: "verified_by", type: "uuid", nullable: true })
  verifiedBy: string | null;

  @Column({ name: "verified_at", type: "timestamptz", nullable: true })
  verifiedAt: Date | null;

  // RN-V2/V3: o método registra COMO o admin verificou. Enum nativo (como
  // `verification`) para o banco recusar valor inventado, não só o Zod.
  @Column({
    name: "verification_method",
    type: "enum",
    enum: VerificationMethod,
    nullable: true,
  })
  verificationMethod: VerificationMethod | null;

  @Column({ name: "rejection_reason", type: "text", nullable: true })
  rejectionReason: string | null;

  @Column({ name: "active", type: "boolean", default: true })
  active: boolean;

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt: Date;
}
