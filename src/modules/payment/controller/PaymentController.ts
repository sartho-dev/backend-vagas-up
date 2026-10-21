import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware/asyncHandler";
import { ApiResponse } from "../../../shared/types/ApiResponse";
import { getAuth } from "../../auth/types/AccountRole";
import { PaymentService } from "../service/PaymentService";
import { PaymentResult } from "../types/PaymentTypes";
import {
  confirmPaymentSchema,
  listPaymentsQuerySchema,
  paymentQuerySchema,
  rejectPaymentSchema,
  vacancyIdParamSchema,
} from "../validators/PaymentValidator";

// RF37: tudo aqui é do administrador. A fila é de VAGAS aguardando
// pagamento; a listagem por período é de pagamentos já decididos.
export class PaymentController {
  constructor(private payments: PaymentService) {}

  queueController = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = paymentQuerySchema.parse(req.query);

    const data = await this.payments.listQueueService({ page, limit });

    res.status(200).json({ status: "success", data } satisfies ApiResponse);
  });

  confirmController = asyncHandler(async (req: Request, res: Response) => {
    const { vacancyId } = vacancyIdParamSchema.parse(req.params);
    const { note } = confirmPaymentSchema.parse(req.body);
    const { accountId } = getAuth(res);

    const data = await this.payments.confirmService(accountId, vacancyId, note);

    const response: ApiResponse<PaymentResult> = { status: "success", data };
    res.status(201).json(response);
  });

  rejectController = asyncHandler(async (req: Request, res: Response) => {
    const { vacancyId } = vacancyIdParamSchema.parse(req.params);
    const { reason, moneyReceived } = rejectPaymentSchema.parse(req.body);
    const { accountId } = getAuth(res);

    const data = await this.payments.rejectService(
      accountId,
      vacancyId,
      reason,
      moneyReceived,
    );

    const response: ApiResponse<PaymentResult> = { status: "success", data };
    res.status(201).json(response);
  });

  listController = asyncHandler(async (req: Request, res: Response) => {
    const query = listPaymentsQuerySchema.parse(req.query);

    const data = await this.payments.listService(query);

    res.status(200).json({ status: "success", data } satisfies ApiResponse);
  });
}
