import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware/asyncHandler";
import { ApiResponse } from "../../../shared/types/ApiResponse";
import { PublicVacancyService } from "../service/PublicVacancyService";
import {
  PUBLIC_SEARCH_PAGE_SIZE,
  searchVacanciesQuerySchema,
  vacancySlugParamSchema,
} from "../validators/VacancyValidator";

// RF14 e RF42: sem login. Nenhum método lê `res.locals.auth` — não há
// autenticação nesta rota, e ler identidade aqui seria pedir o que não
// existe.
export class PublicVacancyController {
  constructor(private vacancies: PublicVacancyService) {}

  searchController = asyncHandler(async (req: Request, res: Response) => {
    const query = searchVacanciesQuerySchema.parse(req.query);

    const data = await this.vacancies.searchService({
      ...query,
      limit: PUBLIC_SEARCH_PAGE_SIZE,
    });

    res.status(200).json({ status: "success", data } satisfies ApiResponse);
  });

  getBySlugController = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = vacancySlugParamSchema.parse(req.params);

    const data = await this.vacancies.getBySlugService(slug);

    res.status(200).json({ status: "success", data } satisfies ApiResponse);
  });
}
