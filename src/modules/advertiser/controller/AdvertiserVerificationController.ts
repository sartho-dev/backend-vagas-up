import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware/asyncHandler";
import { ApiResponse } from "../../../shared/types/ApiResponse";
import { getAuth } from "../../auth/types/AccountRole";
import { AdvertiserVerificationService } from "../service/AdvertiserVerificationService";
import { CnpjLookupReport } from "@/shared/types/VerificationTypes";
import {
  advertiserIdParamSchema,
  decideVerificationSchema,
  listVerificationQueueSchema,
} from "../validators/AdvertiserValidator";

export class AdvertiserVerificationController {
  constructor(private verification: AdvertiserVerificationService) {}

  // RF21 (RESPONSIBLE)

  // RF30 (ADMIN)
  listPendingController = asyncHandler(async (req: Request, res: Response) => {
    const options = listVerificationQueueSchema.parse(req.query);
    const data = await this.verification.listPendingForAdminService(options);

    const response: ApiResponse = { status: "success", data };
    res.status(200).json(response);
  });

  // RF30 (ADMIN)
  getDetailForAdminController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = advertiserIdParamSchema.parse(req.params);
      const data = await this.verification.getDetailForAdminService(id);

      const response: ApiResponse = { status: "success", data };
      res.status(200).json(response);
    },
  );

  // RN-V2 (ADMIN)
  cnpjLookupController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = advertiserIdParamSchema.parse(req.params);
    const data = await this.verification.cnpjLookupService(id);

    const response: ApiResponse<CnpjLookupReport> = { status: "success", data };
    res.status(200).json(response);
  });

  // RF30 (ADMIN)
  decideController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = advertiserIdParamSchema.parse(req.params);
    const input = decideVerificationSchema.parse(req.body);
    const { accountId } = getAuth(res);

    await this.verification.decideService(accountId, id, input);

    res.status(204).send();
  });
}
