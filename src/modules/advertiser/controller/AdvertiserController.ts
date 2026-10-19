import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware/asyncHandler";
import { ApiResponse } from "../../../shared/types/ApiResponse";
import { getAuth } from "../../auth/types/AccountRole";
import { AdvertiserService } from "../service/AdvertiserService";
import {
  AdvertiserResult,
  ResponsibleResult,
} from "../types/AdvertiserTypes";
import {
  acceptInviteSchema,
  inviteResponsibleSchema,
  registerAdvertiserSchema,
  responsibleIdParamSchema,
  updateAdvertiserSchema,
} from "../validators/AdvertiserValidator";

export class AdvertiserController {
  constructor(private advertisers: AdvertiserService) {}

  registerController = asyncHandler(async (req: Request, res: Response) => {
    const input = registerAdvertiserSchema.parse(req.body);

    const data = await this.advertisers.registerService(input);

    const response: ApiResponse = { status: "success", data };
    res.status(201).json(response);
  });

  acceptInviteController = asyncHandler(async (req: Request, res: Response) => {
    const input = acceptInviteSchema.parse(req.body);

    const data = await this.advertisers.acceptInviteService(input);

    const response: ApiResponse<ResponsibleResult> = {
      status: "success",
      data,
    };
    res.status(201).json(response);
  });

  getOwnController = asyncHandler(async (_req: Request, res: Response) => {
    const { accountId } = getAuth(res);

    const data = await this.advertisers.getOwnService(accountId);

    const response: ApiResponse<AdvertiserResult> = {
      status: "success",
      data,
    };
    res.status(200).json(response);
  });

  updateOwnController = asyncHandler(async (req: Request, res: Response) => {
    const input = updateAdvertiserSchema.parse(req.body);
    const { accountId } = getAuth(res);

    const data = await this.advertisers.updateOwnService(accountId, input);

    const response: ApiResponse<AdvertiserResult> = {
      status: "success",
      data,
    };
    res.status(200).json(response);
  });

  listResponsiblesController = asyncHandler(
    async (_req: Request, res: Response) => {
      const { accountId } = getAuth(res);

      const data = await this.advertisers.listOwnResponsiblesService(accountId);

      const response: ApiResponse<ResponsibleResult[]> = {
        status: "success",
        data,
      };
      res.status(200).json(response);
    },
  );

  inviteResponsibleController = asyncHandler(
    async (req: Request, res: Response) => {
      const { email } = inviteResponsibleSchema.parse(req.body);
      const { accountId } = getAuth(res);

      await this.advertisers.inviteOwnResponsibleService(accountId, email);

      res.status(204).send();
    },
  );

  deactivateResponsibleController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = responsibleIdParamSchema.parse(req.params);
      const { accountId } = getAuth(res);

      await this.advertisers.deactivateOwnResponsibleService(accountId, id);

      res.status(204).send();
    },
  );
}
