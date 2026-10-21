import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Admin } from "../../admin/schema/Admin.schema";
import { SettingKey } from "../types/PricingEnums";

// SRS 6 (CONFIGURACAO): chave, valor e quando mudou. Guarda ajustes que o
// administrador muda sem deploy — o link da comunidade (RF41) e o contato
// de "Anuncie aqui" (RF40).
//
// A chave é a PK e o tipo é enum: ver `SettingKey` para o porquê de a lista
// ser fechada.
@Entity("settings")
export class Setting {
  @PrimaryColumn({ name: "key", type: "enum", enum: SettingKey })
  key: SettingKey;

  @Column({ name: "value", type: "text" })
  value: string;

  // Divergência deliberada do modelo da v4.9, que só prevê `atualizado_em`:
  // a RNF07 manda registrar o autor de toda decisão do administrador, e
  // trocar o link que todos os anunciantes verificados recebem é uma delas.
  // Nulo nunca acontece hoje (só o admin escreve aqui); é nulável para a
  // mesma carga inicial sem autor dos preços.
  @ManyToOne(() => Admin, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "updated_by" })
  updatedByAdmin: Admin | null;

  @Column({ name: "updated_by", type: "uuid", nullable: true })
  updatedBy: string | null;

  @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
  updatedAt: Date;
}
