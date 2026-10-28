import { AppError } from "../../../shared/errors/AppError";
import { VerificationStatus } from "../../advertiser/types/AdvertiserEnums";
import {
  IVacancyRepository,
  SearchVacanciesOptions,
} from "../interfaces/IVacancyRepository";
import { Vacancy } from "../schema/Vacancy.schema";
import { WORK_HOURS_UNIT } from "../types/VacancyEnums";
import {
  PublicVacancyDetail,
  PublicVacancySummary,
  SCAM_WARNING,
} from "../types/VacancyTypes";

function toSummary(vacancy: Vacancy): PublicVacancySummary {
  return {
    id: vacancy.id,
    // `slug` e `published_at` são nulos só antes da publicação, e nada aqui
    // chega sem ser público — o `!` é sobre a consulta, não uma aposta.
    slug: vacancy.slug!,
    title: vacancy.title,
    type: vacancy.type,
    modality: vacancy.modality,
    city: vacancy.city,
    workHours: vacancy.workHours,
    // RN-VG4: 6 significa 6 h diárias num jovem aprendiz. O número sem a
    // unidade enganaria o candidato sobre a jornada.
    workHoursUnit: WORK_HOURS_UNIT[vacancy.type],
    minEducation: vacancy.minEducation,
    requiresAdult: vacancy.requiresAdult,
    positions: vacancy.positions,
    compensation: vacancy.compensation,
    deadline: vacancy.deadline,
    publishedAt: vacancy.publishedAt!,
    advertiserName: vacancy.advertiser.displayName,
    advertiserVerified:
      vacancy.advertiser.verification === VerificationStatus.VERIFIED,
  };
}

function toDetail(vacancy: Vacancy): PublicVacancyDetail {
  return {
    ...toSummary(vacancy),
    description: vacancy.description,
    requirements: vacancy.requirements,
    benefits: vacancy.benefits,
    schedule: vacancy.schedule,
    courseId: vacancy.courseId,
    courseName: vacancy.course?.name ?? null,
    expiresAt: vacancy.expiresAt!,
  };
}

// RF14 e RF42: a parte do site que funciona SEM LOGIN. Nenhum método aqui
// recebe identidade de quem chama, e é de propósito: qualquer coisa que
// dependa de quem está olhando pertence a outro service.
export class PublicVacancyService {
  constructor(private repository: IVacancyRepository) {}

  // RF14: só vaga aberta e dentro do prazo, filtros combináveis, mais
  // recentes primeiro, 20 por página.
  async searchService(options: Omit<SearchVacanciesOptions, "now">) {
    const { items, total } = await this.repository.search({
      ...options,
      now: new Date(),
    });

    return {
      items: items.map(toSummary),
      total,
      page: options.page,
      limit: options.limit,
      // RN-V6: no topo da resposta, uma vez. A regra pede o aviso em toda
      // página de vaga, e a página de resultados é uma delas; repeti-lo
      // dentro de cada um dos 20 itens só engordaria o corpo.
      scamWarning: SCAM_WARNING,
    };
  }

  // RF42: a página da vaga, encontrada pelo endereço legível.
  async getBySlugService(
    slug: string,
  ): Promise<{ vacancy: PublicVacancyDetail; scamWarning: string }> {
    const vacancy = await this.repository.findPublicBySlug(slug, new Date());

    if (!vacancy) {
      throw new AppError("Vaga não encontrada", 404);
    }

    return { vacancy: toDetail(vacancy), scamWarning: SCAM_WARNING };
  }
}
