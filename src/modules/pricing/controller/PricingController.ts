import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware/asyncHandler";
import { ApiResponse } from "../../../shared/types/ApiResponse";
import { getAuth } from "../../auth/types/AccountRole";
import { SettingService } from "../service/SettingService";
import { VacancyPriceService } from "../service/VacancyPriceService";
import { SettingResult, VacancyPriceResult } from "../types/PricingTypes";
import {
  settingKeyParamSchema,
  updateSettingSchemaFor,
  updateVacancyPriceSchema,
  vacancyTypeParamSchema,
} from "../validators/PricingValidator";

// RF39 e CONFIGURACAO: duas tabelas pequenas que só o administrador edita.
// Um controller para as duas porque são a mesma tela do painel; os services
// seguem separados.
export class PricingController {
  constructor(
    private prices: VacancyPriceService,
    private settings: SettingService,
  ) {}

  listPricesController = asyncHandler(async (_req: Request, res: Response) => {
    const data = await this.prices.listService();

    const response: ApiResponse<VacancyPriceResult[]> = {
      status: "success",
      data,
    };
    res.status(200).json(response);
  });

  updatePriceController = asyncHandler(async (req: Request, res: Response) => {
    const { type } = vacancyTypeParamSchema.parse(req.params);
    const { value } = updateVacancyPriceSchema.parse(req.body);
    const { accountId } = getAuth(res);

    const data = await this.prices.updateService(accountId, type, value);

    const response: ApiResponse<VacancyPriceResult> = {
      status: "success",
      data,
    };
    res.status(200).json(response);
  });

  listSettingsController = asyncHandler(
    async (_req: Request, res: Response) => {
      const data = await this.settings.listService();

      const response: ApiResponse<SettingResult[]> = {
        status: "success",
        data,
      };
      res.status(200).json(response);
    },
  );

  updateSettingController = asyncHandler(
    async (req: Request, res: Response) => {
      const { key } = settingKeyParamSchema.parse(req.params);
      // O corpo depende da chave: o link da comunidade exige https, o
      // contato é texto livre.
      const { value } = updateSettingSchemaFor(key).parse(req.body);
      const { accountId } = getAuth(res);

      const data = await this.settings.updateService(accountId, key, value);

      const response: ApiResponse<SettingResult> = { status: "success", data };
      res.status(200).json(response);
    },
  );
}
