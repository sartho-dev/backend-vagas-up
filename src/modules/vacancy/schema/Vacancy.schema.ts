import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Advertiser } from "../../advertiser/schema/Advertiser.schema";
import { Course } from "../../course/schema/Course.schema";
import { Responsible } from "../../advertiser/schema/Responsible.schema";
import { EducationLevel } from "../../student/types/StudentEnums";
import { VacancyType } from "../../../shared/types/VacancyType";
import { VacancyModality, VacancySituation } from "../types/VacancyEnums";

// SRS 6 (VAGA) + RF24. A vaga nasce rascunho e só vira pública ao ser
// publicada; depois disso não é editada (RN-P5).
//
// Os nomes das colunas seguem o inglês do resto do banco (`advertisers`,
// `display_name`), e os VALORES dos enums seguem o português do SRS, porque
// aparecem na URL e no corpo das respostas — mesma convenção de
// `VacancyType` e `VerificationStatus`.
@Entity("vacancies")
// A busca pública (task 15) filtra por situação, e as rotas do responsável
// listam por anunciante; os dois índices cobrem os dois acessos.
@Index(["advertiserId"])
@Index(["situation"])
export class Vacancy {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // RESTRICT como toda FK do projeto (RNF06): anunciante é desativado, não
  // apagado.
  @ManyToOne(() => Advertiser, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "advertiser_id" })
  advertiser: Advertiser;

  @Column({ name: "advertiser_id", type: "uuid" })
  advertiserId: string;

  // RNF07: qual responsável criou a vaga. O anunciante pode ter vários
  // (dono e RH), e a vaga é um ato de um deles.
  @ManyToOne(() => Responsible, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by" })
  createdByResponsible: Responsible;

  @Column({ name: "created_by", type: "uuid" })
  createdBy: string;

  @Column({ name: "type", type: "enum", enum: VacancyType })
  type: VacancyType;

  // RN-VG9: a vaga NÃO define faixa de idade — anúncio com limite de idade
  // é prática discriminatória (Lei 9.029/1995). Só esta marca existe, e só
  // quando a lei proíbe menores (trabalho noturno, perigoso ou insalubre).
  // A idade do candidato é conferida na candidatura (task 16), não aqui.
  @Column({ name: "requires_adult", type: "boolean", default: false })
  requiresAdult: boolean;

  @Column({ name: "title", type: "varchar", length: 150 })
  title: string;

  @Column({ name: "description", type: "text" })
  description: string;

  @Column({ name: "modality", type: "enum", enum: VacancyModality })
  modality: VacancyModality;

  @Column({ name: "city", type: "varchar", length: 100 })
  city: string;

  // RN-VG4: o número que o anunciante digitou, na unidade do tipo da vaga —
  // SEMANAL para estágio e emprego, DIÁRIA para jovem aprendiz. O porquê
  // está em WORK_HOURS_LIMIT; quem exibe a vaga lê WORK_HOURS_UNIT para
  // saber o rótulo. `numeric` e não `int` porque meia hora existe (4,5 h).
  @Column({
    name: "work_hours",
    type: "numeric",
    precision: 4,
    scale: 1,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  workHours: number;

  // RN-C3 (task 16) compara esta com a escolaridade do candidato, pela
  // ordem de EDUCATION_LEVEL_ORDER.
  @Column({ name: "min_education", type: "enum", enum: EducationLevel })
  minEducation: EducationLevel;

  // RF24: curso desejado é opcional. SET NULL seria perder a intenção da
  // vaga em silêncio, e a task 08 já impede apagar curso em uso.
  @ManyToOne(() => Course, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "course_id" })
  course: Course | null;

  @Column({ name: "course_id", type: "uuid", nullable: true })
  courseId: string | null;

  @Column({ name: "requirements", type: "text", nullable: true })
  requirements: string | null;

  @Column({ name: "benefits", type: "text", nullable: true })
  benefits: string | null;

  // Texto livre, não número: "a combinar" e "R$ 1.200 + VT" são respostas
  // legítimas da RF24, que lista remuneração como campo opcional e não
  // como valor a comparar.
  @Column({
    name: "compensation",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  compensation: string | null;

  @Column({ name: "schedule", type: "varchar", length: 100, nullable: true })
  schedule: string | null;

  // RN-VG3: prazo de candidatura, opcional. Validado no envio: não pode
  // ser anterior à publicação nem passar dos 60 dias de validade.
  @Column({ name: "deadline", type: "timestamptz", nullable: true })
  deadline: Date | null;

  // RN-P5: uma vaga pode abrir mais de uma posição para o mesmo cargo.
  @Column({ name: "positions", type: "int", default: 1 })
  positions: number;

  @Column({
    name: "situation",
    type: "enum",
    enum: VacancySituation,
    default: VacancySituation.DRAFT,
  })
  situation: VacancySituation;

  // RN-P1: a primeira vaga do anunciante é gratuita. Decidido no envio
  // (RN-P2) e gravado aqui, porque a resposta não pode mudar depois: se
  // fosse recalculada na leitura, excluir uma vaga antiga tornaria outra
  // "gratuita" retroativamente.
  @Column({ name: "free", type: "boolean", default: false })
  free: boolean;

  // RN-P8: cópia do preço no momento do ENVIO, não uma leitura ao vivo da
  // tabela de preços. É este valor que aparece no PIX e no pagamento —
  // alteração de preço depois não alcança a vaga já enviada. Nulo enquanto
  // a vaga é rascunho: ainda não foi enviada, logo não tem valor.
  @Column({
    name: "value",
    type: "numeric",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : Number(value)),
    },
  })
  value: number | null;

  // RN-P3: vai na descrição do PIX, então alguém o digita à mão — daí ser
  // curto e sem caracteres ambíguos. Nasce com a vaga, não no envio: serve
  // também como o número pelo qual o anunciante se refere a ela.
  @Column({
    name: "reference_code",
    type: "varchar",
    length: 12,
    unique: true,
  })
  referenceCode: string;

  // RF42: o endereço público e legível da vaga, como
  // `vendedor-centro-k3m9qp`. Nulo até a publicação: rascunho e vaga
  // aguardando pagamento não têm página, e um link que abre em 404 é pior
  // que link nenhum. UNIQUE porque é por ele que a página é encontrada.
  @Column({
    name: "slug",
    type: "varchar",
    length: 180,
    nullable: true,
    unique: true,
  })
  slug: string | null;

  // A coluna `search_vector` (tsvector GERADO, com índice GIN) existe no
  // banco mas NÃO é mapeada aqui de propósito: o Postgres a calcula de
  // `title`, `city` e `description`, e qualquer tentativa do TypeORM de
  // escrevê-la seria erro. A busca a referencia em SQL cru, no repositório.

  @Column({ name: "published_at", type: "timestamptz", nullable: true })
  publishedAt: Date | null;

  // RN-VG2 / RN-P4: `published_at` + 60 dias, gravado na publicação. Quem
  // encerra de fato é a rotina diária da task 22; guardar a data em vez de
  // calculá-la na leitura é o que permite àquela rotina achar as vencidas
  // com um WHERE em vez de varrer a tabela.
  @Column({ name: "expires_at", type: "timestamptz", nullable: true })
  expiresAt: Date | null;

  @Column({ name: "closed_at", type: "timestamptz", nullable: true })
  closedAt: Date | null;

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt: Date;

  @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
  updatedAt: Date;
}
