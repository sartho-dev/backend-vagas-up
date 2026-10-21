import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Admin } from "../../admin/schema/Admin.schema";
import { Vacancy } from "../../vacancy/schema/Vacancy.schema";
import { PaymentSituation } from "../types/PaymentEnums";

// SRS 6 (PAGAMENTO) + RF28. Uma linha por vaga, criada no momento em que o
// administrador decide sobre o PIX.
//
// RN-P7: o sistema NÃO guarda comprovante. Só valor, data, código de
// referência e quem decidiu — nada de arquivo enviado pelo anunciante, que
// seria dado pessoal e financeiro guardado sem necessidade.
@Entity("payments")
// "Ver pagamentos por período" (RF37) filtra por data.
@Index(["decidedAt"])
export class Payment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // UNIQUE, como o SRS 6 descreve: um pagamento por vaga, para sempre. É
  // isso que torna a recusa terminal — a vaga recusada é encerrada e o
  // anunciante publica outra (decisão de 21/10/2026, no TASKS.md).
  @ManyToOne(() => Vacancy, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "vacancy_id" })
  vacancy: Vacancy;

  @Column({ name: "vacancy_id", type: "uuid", unique: true })
  vacancyId: string;

  // Cópia da cópia: o valor vem da LINHA DA VAGA, não da tabela de preços
  // (RN-P8). A vaga já guardou o preço do momento do envio; reler a tabela
  // aqui faria o pagamento registrar um valor diferente do que foi cobrado.
  @Column({
    name: "value",
    type: "numeric",
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  value: number;

  // RN-P3: é por ele que o admin encontra o PIX no extrato. Copiado da vaga
  // e guardado aqui também, porque o pagamento é o registro contábil e tem
  // de se sustentar sozinho, mesmo que a vaga mude de estado depois.
  @Column({ name: "reference_code", type: "varchar", length: 12 })
  referenceCode: string;

  @Column({ name: "situation", type: "enum", enum: PaymentSituation })
  situation: PaymentSituation;

  // O SRS chama estas duas de `confirmado_por` e `confirmado_em`. Aqui são
  // `decided_by` / `decided_at` porque a mesma linha registra recusa e
  // reembolso, não só confirmação — "confirmado_por" numa linha recusada
  // leria como o contrário do que aconteceu. Divergência deliberada,
  // registrada no TASKS.md.
  //
  // NOT NULL: a linha só existe depois da decisão. RESTRICT porque admin é
  // desativado, não apagado (RF34), e este é um registro contábil.
  @ManyToOne(() => Admin, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "decided_by" })
  decidedByAdmin: Admin;

  @Column({ name: "decided_by", type: "uuid" })
  decidedBy: string;

  @Column({ name: "decided_at", type: "timestamptz", default: () => "now()" })
  decidedAt: Date;

  // Motivo da recusa (obrigatório na recusa) ou observação do admin na
  // confirmação. Texto livre: é o que explica a decisão a quem auditar.
  @Column({ name: "note", type: "text", nullable: true })
  note: string | null;
}
