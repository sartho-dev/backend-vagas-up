import { Router } from "express";
import { Container } from "../../shared/container";
import { authorize } from "../auth/middleware/authorize";
import { AccountRole } from "../auth/types/AccountRole";

export function adminRoutes(container: Container): Router {
  const router = Router();

  // RF02 / Anexo A: everything under /api/v1/admin is for administrators only.
  // Applied once here, so no route added below can forget it.
  //   no token             -> 401
  //   student / responsible -> 403
  router.use(container.authenticate, authorize(AccountRole.ADMIN));

  // Subtask 2 onwards: admin management, student accounts, CPF correction.

  return router;
}
