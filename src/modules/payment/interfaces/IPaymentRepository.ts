import { Payment } from "../schema/Payment.schema";
import { PaymentSituation } from "../types/PaymentEnums";

export type RecordPaymentData = {
  vacancyId: string;
  // Copiado da LINHA DA VAGA, não da tabela de preços (RN-P8).
  value: number;
  referenceCode: string;
  situation: PaymentSituation;
  decidedBy: string;
  note: string | null;
};

export type ListPaymentsOptions = {
  // RF37: "ver pagamentos por período". Os dois limites são opcionais —
  // sem nenhum, lista tudo da página pedida.
  from?: Date;
  to?: Date;
  situation?: PaymentSituation;
  page: number;
  limit: number;
};

export type ListPaymentsResult = {
  items: Payment[];
  total: number;
  // RF37: o painel mostra quanto entrou no período. Somar na aplicação só
  // as linhas da PÁGINA daria um total errado a cada página.
  confirmedTotal: number;
};

export interface IPaymentRepository {
  // Uma linha por vaga, para sempre (UK). Devolve null se já existir uma —
  // o service traduz isso em 409, que é o que acontece quando dois admins
  // decidem a mesma vaga ao mesmo tempo.
  record(data: RecordPaymentData): Promise<Payment | null>;

  findByVacancy(vacancyId: string): Promise<Payment | null>;

  list(options: ListPaymentsOptions): Promise<ListPaymentsResult>;
}
