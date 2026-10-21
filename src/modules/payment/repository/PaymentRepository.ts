import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from "typeorm";
import { Payment } from "../schema/Payment.schema";
import {
  IPaymentRepository,
  ListPaymentsOptions,
  ListPaymentsResult,
  RecordPaymentData,
} from "../interfaces/IPaymentRepository";
import { PaymentSituation } from "../types/PaymentEnums";

// Violação de unicidade: só `vacancy_id` é UNIQUE nesta tabela.
const UNIQUE_VIOLATION = "23505";

export class PaymentRepository implements IPaymentRepository {
  constructor(private repository: Repository<Payment>) {}

  async record(data: RecordPaymentData): Promise<Payment | null> {
    try {
      return await this.repository.save(this.repository.create(data));
    } catch (error) {
      // O UK é a trava de verdade contra dois admins decidindo a mesma vaga
      // ao mesmo tempo: a checagem antes do INSERT sempre tem uma janela
      // entre o SELECT e o INSERT, o índice não tem.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        return null;
      }

      throw error;
    }
  }

  async findByVacancy(vacancyId: string): Promise<Payment | null> {
    return await this.repository.findOne({ where: { vacancyId } });
  }

  async list(options: ListPaymentsOptions): Promise<ListPaymentsResult> {
    const where: Record<string, unknown> = {};

    if (options.from && options.to) {
      where.decidedAt = Between(options.from, options.to);
    } else if (options.from) {
      where.decidedAt = MoreThanOrEqual(options.from);
    } else if (options.to) {
      where.decidedAt = LessThanOrEqual(options.to);
    }

    if (options.situation) {
      where.situation = options.situation;
    }

    const [items, total] = await this.repository.findAndCount({
      where,
      // `id` desempata, então a ordem é total e as páginas não se repetem
      // nem pulam linha — mesma escolha da listagem de admins.
      order: { decidedAt: "DESC", id: "DESC" },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });

    // Soma no BANCO, sobre o período inteiro, não sobre a página: o painel
    // mostra quanto entrou no período, e somar `items` daria um número
    // diferente a cada página.
    //
    // As condições são escritas à mão em vez de reaproveitar o `where`
    // acima: o QueryBuilder não interpreta os operadores do TypeORM
    // (`Between`, `MoreThanOrEqual`) — ele os trataria como valor literal
    // e a soma sairia errada em silêncio.
    const sumQuery = this.repository
      .createQueryBuilder("payment")
      .select("COALESCE(SUM(payment.value), 0)", "sum")
      .where("payment.situation = :situation", {
        situation: PaymentSituation.CONFIRMED,
      });

    if (options.from) {
      sumQuery.andWhere("payment.decided_at >= :from", { from: options.from });
    }
    if (options.to) {
      sumQuery.andWhere("payment.decided_at <= :to", { to: options.to });
    }

    const { sum } = (await sumQuery.getRawOne()) as { sum: string };

    return { items, total, confirmedTotal: Number(sum) };
  }
}
