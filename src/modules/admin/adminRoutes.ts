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

  const admins = container.adminController;
  const courses = container.courseController;

  // RF21: manage administrators
  router.post("/administrators", admins.createController.bind(admins));
  router.get("/administrators", admins.listController.bind(admins));

  // RF22: own profile. Declared before the /:id routes on purpose.
  router.patch(
    "/administrators/me",
    admins.updateOwnProfileController.bind(admins),
  );

  // RF20 / RN32: student accounts seen by the administrator
  router.get("/students", admins.listStudentsController.bind(admins));

  router.patch(
    "/administrators/:id/deactivate",
    admins.deactivateController.bind(admins),
  );
  router.patch(
    "/administrators/:id/reactivate",
    admins.reactivateController.bind(admins),
  );

  // RF33: manutenção de cursos. A leitura é pública e fica em
  // `courseRoutes`; aqui só o que exige administrador.
  router.post("/courses", courses.createController.bind(courses));
  router.patch("/courses/:id", courses.renameController.bind(courses));
  router.delete("/courses/:id", courses.deleteController.bind(courses));

  return router;
  // Subtask 2 onwards: admin management, student accounts, CPF correction.
}
