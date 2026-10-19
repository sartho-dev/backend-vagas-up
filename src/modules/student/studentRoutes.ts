import { Router } from "express";
import { Container } from "../../shared/container";
import { authorize } from "../auth/middleware/authorize";
import { AccountRole } from "../auth/types/AccountRole";

export function studentRoutes(container: Container): Router {
  const router = Router();
  const students = container.studentController;

  // RF10: cadastro é público.
  router.post("/", students.createController.bind(students));

  // RF02 / Anexo A: tudo sob /me exige sessão de CANDIDATO. O authorize não
  // pode ficar no router inteiro porque o cadastro acima é público — então
  // vai num sub-router, aplicado uma vez, para nenhuma rota nova de perfil
  // esquecer. Sem ele, um token de admin alcançaria o service do candidato.
  const me = Router();
  me.use(container.authenticate, authorize(AccountRole.STUDENT));

  me.get("/", students.getOwnProfileController.bind(students));
  me.patch("/", students.updateOwnProfileController.bind(students));
  me.patch("/password", students.changePasswordController.bind(students));

  router.use("/me", me);

  return router;
}
