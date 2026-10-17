import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware/asyncHandler";
import { AccountRecoveryService } from "../service/AccountRecoveryService";
import { getAuth } from "../types/AccountRole";
import {
  confirmEmailChangeSchema,
  confirmPasswordRecoverySchema,
  requestEmailChangeSchema,
  requestPasswordRecoverySchema,
} from "../validators/RecoveryValidator";

export class RecoveryController {
  constructor(private recovery: AccountRecoveryService) {}

  // RF01 / RN-A6. Sempre 204, exista ou não o e-mail: um 404 aqui diria ao
  // atacante quais endereços estão cadastrados.
  requestPasswordRecoveryController = asyncHandler(
    async (req: Request, res: Response) => {
      const { email } = requestPasswordRecoverySchema.parse(req.body);

      await this.recovery.requestPasswordRecovery(email);

      res.status(204).send();
    },
  );

  confirmPasswordRecoveryController = asyncHandler(
    async (req: Request, res: Response) => {
      const { token, newPassword } = confirmPasswordRecoverySchema.parse(
        req.body,
      );

      await this.recovery.confirmPasswordRecovery(token, newPassword);

      res.status(204).send();
    },
  );

  // RF03: exige sessão — só o dono pede a troca do próprio e-mail.
  requestEmailChangeController = asyncHandler(
    async (req: Request, res: Response) => {
      const { newEmail } = requestEmailChangeSchema.parse(req.body);
      const { role, accountId } = getAuth(res);

      await this.recovery.requestEmailChange(role, accountId, newEmail);

      res.status(204).send();
    },
  );

  // Público: quem confirma está clicando no link do e-mail, e pode nem estar
  // logado no navegador em que abriu.
  confirmEmailChangeController = asyncHandler(
    async (req: Request, res: Response) => {
      const { token } = confirmEmailChangeSchema.parse(req.body);

      await this.recovery.confirmEmailChange(token);

      res.status(204).send();
    },
  );
}
