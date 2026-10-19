import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware/asyncHandler";
import { ApiResponse } from "../../../shared/types/ApiResponse";
import { getAuth } from "../../auth/types/AccountRole";
import { FormationService } from "../service/FormationService";
import { FormationResult } from "../types/FormationTypes";
import {
  createFormationSchema,
  formationIdParamSchema,
  updateFormationSchema,
} from "../validators/FormationValidator";

// Todas as rotas vivem sob /students/me, então o candidato vem da sessão e
// nunca da URL: não há como pedir a formação de outra pessoa.
export class FormationController {
  constructor(private formations: FormationService) {}

  listController = asyncHandler(async (_req: Request, res: Response) => {
    const { accountId: studentId } = getAuth(res);

    const data = await this.formations.listService(studentId);

    const response: ApiResponse<FormationResult[]> = {
      status: "success",
      data,
    };
    res.status(200).json(response);
  });

  createController = asyncHandler(async (req: Request, res: Response) => {
    const input = createFormationSchema.parse(req.body);
    const { accountId: studentId } = getAuth(res);

    const data = await this.formations.createService(studentId, input);

    const response: ApiResponse<FormationResult> = { status: "success", data };
    res.status(201).json(response);
  });

  updateController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = formationIdParamSchema.parse(req.params);
    const input = updateFormationSchema.parse(req.body);
    const { accountId: studentId } = getAuth(res);

    const data = await this.formations.updateService(studentId, id, input);

    const response: ApiResponse<FormationResult> = { status: "success", data };
    res.status(200).json(response);
  });

  deleteController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = formationIdParamSchema.parse(req.params);
    const { accountId: studentId } = getAuth(res);

    await this.formations.deleteService(studentId, id);

    res.status(204).send();
  });
}
