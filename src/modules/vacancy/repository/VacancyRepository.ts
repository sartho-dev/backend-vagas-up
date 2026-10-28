import { Not, Repository } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";
import { Vacancy } from "../schema/Vacancy.schema";
import {
  CreateVacancyData,
  IVacancyRepository,
  SearchVacanciesOptions,
  SearchVacanciesResult,
  ListAwaitingPaymentOptions,
  ListAwaitingPaymentResult,
  VacancyTransition,
} from "../interfaces/IVacancyRepository";
import { VacancyPatch } from "../types/VacancyTypes";
import { VacancySituation } from "../types/VacancyEnums";
import { buildVacancySlug } from "../service/VacancySlug";

// Só `reference_code` e `slug` são UNIQUE nesta tabela, e o código já está
// gravado quando a publicação acontece — então um 23505 aqui é colisão de
// slug.
const UNIQUE_VIOLATION = "23505";
const SLUG_ATTEMPTS = 5;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}

export class VacancyRepository implements IVacancyRepository {
  constructor(private repository: Repository<Vacancy>) {}

  async create(data: CreateVacancyData): Promise<Vacancy> {
    const vacancy = this.repository.create({
      ...data,
      situation: VacancySituation.DRAFT,
    });

    return await this.repository.save(vacancy);
  }

  async findById(id: string): Promise<Vacancy | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async findOwned(id: string, advertiserId: string): Promise<Vacancy | null> {
    return await this.repository.findOne({ where: { id, advertiserId } });
  }

  async listByAdvertiser(advertiserId: string): Promise<Vacancy[]> {
    return await this.repository.find({
      where: { advertiserId },
      order: { createdAt: "DESC" },
    });
  }

  async update(id: string, patch: VacancyPatch): Promise<Vacancy | null> {
    const result = await this.repository.update(
      { id },
      { ...patch, updatedAt: new Date() },
    );

    if (result.affected === 0) return null;

    return await this.findById(id);
  }

  async publish(
    id: string,
    publishedAt: Date,
    expiresAt: Date,
    extra: { free?: boolean; value?: number | null } = {},
  ): Promise<Vacancy | null> {
    const vacancy = await this.findById(id);

    if (!vacancy) return null;

    // O slug sai do título e da cidade da vaga, com sufixo sorteado. A
    // colisão é improvável (30^6 por título+cidade iguais), mas a coluna é
    // UNIQUE: tentar de novo custa menos que recusar a publicação de uma
    // vaga já paga por causa de um sorteio azarado.
    for (let attempt = 1; attempt <= SLUG_ATTEMPTS; attempt += 1) {
      try {
        const result = await this.repository.update(
          { id },
          {
            ...extra,
            situation: VacancySituation.OPEN,
            publishedAt,
            expiresAt,
            slug: buildVacancySlug(vacancy.title, vacancy.city),
            updatedAt: new Date(),
          },
        );

        if (result.affected === 0) return null;

        return await this.findById(id);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }

    throw new AppError(
      "Não foi possível gerar o endereço público da vaga. Tente novamente",
      503,
    );
  }

  async transition(
    id: string,
    data: VacancyTransition,
  ): Promise<Vacancy | null> {
    const result = await this.repository.update(
      { id },
      { ...data, updatedAt: new Date() },
    );

    if (result.affected === 0) return null;

    return await this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async search(
    options: SearchVacanciesOptions,
  ): Promise<SearchVacanciesResult> {
    const query = this.repository
      .createQueryBuilder("vacancy")
      // `innerJoin` e não `left`: vaga sem anunciante não existe (a FK é
      // NOT NULL), e o inner deixa o Postgres escolher o plano melhor.
      .innerJoinAndSelect("vacancy.advertiser", "advertiser")
      .where("vacancy.situation = :open", { open: VacancySituation.OPEN })
      // "Dentro do prazo" é checado por DATA, não pela situação. A rotina
      // que encerra vaga vencida é diária (task 22), então entre a meia
      // noite e a rotina existe vaga `aberta` já vencida — ela não pode
      // aparecer na busca nesse intervalo.
      .andWhere("vacancy.expires_at > :now", { now: options.now })
      // RN-VG3: o prazo de candidatura é opcional; quando existe e já
      // passou, a vaga continua aberta mas não recebe candidatura, então
      // sai da busca.
      .andWhere("(vacancy.deadline IS NULL OR vacancy.deadline > :now)", {
        now: options.now,
      });

    if (options.type) {
      query.andWhere("vacancy.type = :type", { type: options.type });
    }
    if (options.modality) {
      query.andWhere("vacancy.modality = :modality", {
        modality: options.modality,
      });
    }
    if (options.city) {
      // Em minúsculas dos dois lados: a cidade é texto livre do anunciante,
      // e "Campo Grande" e "campo grande" são a mesma cidade. O índice é
      // sobre `lower(city)` justamente por isso.
      query.andWhere("lower(vacancy.city) = lower(:city)", {
        city: options.city,
      });
    }
    if (options.minEducation) {
      query.andWhere("vacancy.min_education = :minEducation", {
        minEducation: options.minEducation,
      });
    }
    if (options.courseId) {
      query.andWhere("vacancy.course_id = :courseId", {
        courseId: options.courseId,
      });
    }

    if (options.keyword) {
      // `websearch_to_tsquery` e não `to_tsquery`: ele aceita o que a
      // pessoa digita (espaços, aspas, "or") sem explodir com erro de
      // sintaxe. `to_tsquery` exigiria operadores e quebraria na primeira
      // busca com dois termos soltos.
      query.andWhere(
        "vacancy.search_vector @@ websearch_to_tsquery('portuguese', :keyword)",
        { keyword: options.keyword },
      );

      // Com palavra-chave, o mais RELEVANTE vem primeiro e a data desempata
      // — é o que os pesos A/B/C da coluna gerada existem para fazer, e quem
      // digita "vendedor" quer a vaga de vendedor, não a mais recente que
      // menciona vendedor de passagem. Sem palavra-chave vale o "mais
      // recentes primeiro" da RF14, puro.
      query.addSelect(
        "ts_rank(vacancy.search_vector, websearch_to_tsquery('portuguese', :keyword))",
        "rank",
      );
      query.orderBy("rank", "DESC");
      query.addOrderBy("vacancy.published_at", "DESC");
    } else {
      query.orderBy("vacancy.published_at", "DESC");
    }

    // `id` desempata, então a ordem é total e as páginas não se repetem nem
    // pulam vaga — duas vagas publicadas no mesmo instante são comuns.
    query.addOrderBy("vacancy.id", "DESC");

    const [items, total] = await query
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();

    return { items, total };
  }

  async findPublicBySlug(slug: string, now: Date): Promise<Vacancy | null> {
    // EXATAMENTE os mesmos cortes da busca. Uma vaga que saiu da busca não
    // pode continuar acessível pelo link direto, senão o link compartilhado
    // no WhatsApp vira a porta dos fundos — e a vaga suspensa por denúncia
    // (RN-V7), que some da busca para ser julgada, continuaria no ar para
    // quem tem o link.
    //
    // Prazo vencido também responde 404, e não a página com um aviso: sem
    // candidatura possível (task 16), a página seria um convite a se
    // candidatar para nada.
    return await this.repository
      .createQueryBuilder("vacancy")
      .innerJoinAndSelect("vacancy.advertiser", "advertiser")
      .leftJoinAndSelect("vacancy.course", "course")
      .where("vacancy.slug = :slug", { slug })
      .andWhere("vacancy.situation = :open", {
        open: VacancySituation.OPEN,
      })
      .andWhere("vacancy.expires_at > :now", { now })
      .andWhere("(vacancy.deadline IS NULL OR vacancy.deadline > :now)", {
        now,
      })
      .getOne();
  }

  async listAwaitingPayment(
    options: ListAwaitingPaymentOptions,
  ): Promise<ListAwaitingPaymentResult> {
    const [items, total] = await this.repository.findAndCount({
      where: { situation: VacancySituation.AWAITING_PAYMENT },
      relations: { advertiser: true },
      // Mais antiga primeiro: quem enviou antes espera menos. `id`
      // desempata, então as páginas não se repetem nem pulam linha.
      order: { updatedAt: "ASC", id: "ASC" },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });

    return { items, total };
  }

  async countOpen(advertiserId: string): Promise<number> {
    return await this.repository.count({
      where: { advertiserId, situation: VacancySituation.OPEN },
    });
  }

  async hasUsedFreeVacancy(advertiserId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: {
        advertiserId,
        free: true,
        // O rascunho não consome a gratuita: só a partir do envio a vaga
        // passa a ocupar o direito.
        situation: Not(VacancySituation.DRAFT),
      },
    });

    return count > 0;
  }
}
