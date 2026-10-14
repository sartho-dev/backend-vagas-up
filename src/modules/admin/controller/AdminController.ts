import { Request, Response } from "express";
import { AdminService } from "../service/AdminService";
import {
  adminIdParamSchema,
  createAdminSchema,
  listAdminsQuerySchema,
  updateOwnProfileSchema,
} from "../validators/adminValidator";
import { getAuth } from "../../auth/types/AccountRole";
import { ApiResponse } from "../../../shared/types/ApiResponse";
import { asyncHandler } from "../../../shared/middleware/asyncHandler";

// Every route using this controller sits behind authenticate + authorize(ADMIN)
// (see adminRoutes.ts).
export class AdminController {
  constructor(private adminService: AdminService) {}

  // RF21
  createController = asyncHandler(async (req: Request, res: Response) => {
    const data = createAdminSchema.parse(req.body);
    const { accountId: actorId } = getAuth(res);

    const admin = await this.adminService.createService(actorId, data);

    const response: ApiResponse = { status: "success", data: admin };
    res.status(201).json(response);
  });

  // RF21
  listController = asyncHandler(async (req: Request, res: Response) => {
    const query = listAdminsQuerySchema.parse(req.query);

    const result = await this.adminService.listService(query);

    const response: ApiResponse = { status: "success", data: result };
    res.status(200).json(response);
  });

  // RF20 / RN32: student listing, CPF masked by the service.
  listStudentsController = asyncHandler(async (req: Request, res: Response) => {
    const query = listAdminsQuerySchema.parse(req.query);

    const result = await this.adminService.listStudentsService(query);

    const response: ApiResponse = { status: "success", data: result };
    res.status(200).json(response);
  });

  // RF21 / RN21
  deactivateController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = adminIdParamSchema.parse(req.params);
    const { accountId: actorId } = getAuth(res);

    const admin = await this.adminService.deactivateService(actorId, id);

    const response: ApiResponse = { status: "success", data: admin };
    res.status(200).json(response);
  });

  // RF21
  reactivateController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = adminIdParamSchema.parse(req.params);

    const admin = await this.adminService.reactivateService(id);

    const response: ApiResponse = { status: "success", data: admin };
    res.status(200).json(response);
  });

  // RF22 / RN20
  updateOwnProfileController = asyncHandler(
    async (req: Request, res: Response) => {
      const data = updateOwnProfileSchema.parse(req.body);
      const { accountId } = getAuth(res);

      const result = await this.adminService.updateOwnProfileService(
        accountId,
        data,
      );

      const response: ApiResponse = {
        status: "success",
        data: {
          ...result.admin,
          // RN20: after a password change every session is gone, this one too.
          reauthenticationRequired: result.passwordChanged,
        },
        ...(result.passwordChanged && {
          message: "Password changed. All sessions were ended, sign in again.",
        }),
      };

      res.status(200).json(response);
    },
  );
}
