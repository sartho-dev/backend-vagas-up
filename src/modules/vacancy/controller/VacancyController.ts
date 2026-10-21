import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware/asyncHandler";
import { ApiResponse } from "../../../shared/types/ApiResponse";
import { getAuth } from "../../auth/types/AccountRole";
import { VacancyService } from "../service/VacancyService";
import { VacancyPaymentInfo, VacancyResult } from "../types/VacancyTypes";
import {
  createVacancySchema,
  patchVacancySchema,
  submitVacancySchema,
  vacancyIdParamSchema,
} from "../validators/VacancyValidator";

// RF24 a RF29: as rotas do responsável. Nenhuma recebe o id do anunciante —
// ele vem do vínculo do responsável autenticado, no service.
export class VacancyController {
  constructor(private vacancies: VacancyService) {}

  createController = asyncHandler(async (req: Request, res: Response) => {
    const input = createVacancySchema.parse(req.body);
    const { accountId } = getAuth(res);

    const data = await this.vacancies.createService(accountId, input);

    const response: ApiResponse<VacancyResult> = { status: "success", data };
    res.status(201).json(response);
  });

  listController = asyncHandler(async (_req: Request, res: Response) => {
    const { accountId } = getAuth(res);

    const data = await this.vacancies.listOwnService(accountId);

    const response: ApiResponse<VacancyResult[]> = { status: "success", data };
    res.status(200).json(response);
  });

  getController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = vacancyIdParamSchema.parse(req.params);
    const { accountId } = getAuth(res);

    const data = await this.vacancies.getOwnService(accountId, id);

    const response: ApiResponse<VacancyResult> = { status: "success", data };
    res.status(200).json(response);
  });

  updateController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = vacancyIdParamSchema.parse(req.params);
    const patch = patchVacancySchema.parse(req.body);
    const { accountId } = getAuth(res);

    const data = await this.vacancies.updateOwnService(accountId, id, patch);

    const response: ApiResponse<VacancyResult> = { status: "success", data };
    res.status(200).json(response);
  });

  // RF29: o corpo exige `confirmed: true`. Sem isso o envio não acontece —
  // é a dupla confirmação escrita como regra, não como tela.
  submitController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = vacancyIdParamSchema.parse(req.params);
    submitVacancySchema.parse(req.body);
    const { accountId } = getAuth(res);

    const data = await this.vacancies.submitOwnService(accountId, id);

    const response: ApiResponse<VacancyResult> = { status: "success", data };
    res.status(200).json(response);
  });

  // RF28: o que o responsável precisa para fazer o PIX.
  paymentInfoController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = vacancyIdParamSchema.parse(req.params);
    const { accountId } = getAuth(res);

    const data = await this.vacancies.paymentInfoService(accountId, id);

    const response: ApiResponse<VacancyPaymentInfo> = {
      status: "success",
      data,
    };
    res.status(200).json(response);
  });

  closeController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = vacancyIdParamSchema.parse(req.params);
    const { accountId } = getAuth(res);

    const data = await this.vacancies.closeOwnService(accountId, id);

    const response: ApiResponse<VacancyResult> = { status: "success", data };
    res.status(200).json(response);
  });

  deleteController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = vacancyIdParamSchema.parse(req.params);
    const { accountId } = getAuth(res);

    await this.vacancies.deleteOwnService(accountId, id);

    res.status(204).send();
  });
}
