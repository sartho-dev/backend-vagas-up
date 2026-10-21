import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Admin } from "../../admin/schema/Admin.schema";
import { VacancyType } from "../../../shared/types/VacancyType";

// RF39: o administrador edita o valor de cada tipo de vaga.
//
// A PK é o TIPO, não um UUID — é a única tabela do projeto assim, e é de
// propósito: existe exatamente uma linha por tipo de vaga, criada pela
// migration. Com id próprio daria para cadastrar dois preços de estágio e a
// pergunta "quanto custa um estágio?" passaria a ter duas respostas.
// Por isso também não há rota de criar nem de excluir: só de atualizar.
@Entity("vacancy_prices")
export class VacancyPrice {
  @PrimaryColumn({ name: "type", type: "enum", enum: VacancyType })
  type: VacancyType;

  // `numeric` e não `float`: dinheiro em ponto flutuante acumula erro de
  // arredondamento. O driver do Postgres devolve `numeric` como string
  // (precisão arbitrária não cabe em number), então o transformer converte
  // na leitura — os valores aqui são reais, não centavos, e cabem com folga.
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

  // RNF07: quem alterou. Nulo só na carga inicial da migration, que não tem
  // autor — mesma convenção do `alterado_por` do histórico de candidatura
  // no SRS ("vazio = sistema"). RESTRICT porque admin é desativado, não
  // apagado (RF34).
  @ManyToOne(() => Admin, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "updated_by" })
  updatedByAdmin: Admin | null;

  @Column({ name: "updated_by", type: "uuid", nullable: true })
  updatedBy: string | null;

  @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
  updatedAt: Date;
}
