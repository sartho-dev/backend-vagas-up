import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { AdvertiserType, VerificationStatus } from "../types/AdvertiserEnums";

// RF20: quem publica vagas. NÃO faz login — quem entra no sistema são os
// responsáveis (SRS 1.3). Por isso não há senha nem sessão aqui.
@Entity("advertisers")
export class Advertiser {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "type", type: "enum", enum: AdvertiserType })
  type: AdvertiserType;

  // CNPJ (14) ou CPF (11), só dígitos. Único no banco: é o que impede a
  // mesma empresa de ter dois cadastros e burlar a vaga gratuita (RN-P1).
  @Column({ name: "document", type: "varchar", length: 14, unique: true })
  document: string;

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

  // Quando o pedido de verificação foi feito. Não está no modelo da v4.9,
  // mas sem ele não dá para medir o tempo de fila — e o selo "Verificado"
  // só vale enquanto a fila anda. Ver RF21/RF30 (task 11).
  @Column({
    name: "verification_requested_at",
    type: "timestamptz",
    nullable: true,
  })
  verificationRequestedAt: Date | null;

  // RNF07: quem decidiu, quando e por qual método (RN-V2/V3).
  @Column({ name: "verified_by", type: "uuid", nullable: true })
  verifiedBy: string | null;

  @Column({ name: "verified_at", type: "timestamptz", nullable: true })
  verifiedAt: Date | null;

  @Column({
    name: "verification_method",
    type: "varchar",
    length: 150,
    nullable: true,
  })
  verificationMethod: string | null;

  @Column({ name: "rejection_reason", type: "text", nullable: true })
  rejectionReason: string | null;

  @Column({ name: "active", type: "boolean", default: true })
  active: boolean;

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt: Date;
}
