import { Router } from "express";
import { Container } from "../../shared/container";

export function authRoutes(container: Container): Router {
  const router = Router();
  const auth = container.authController;
  const recovery = container.recoveryController;

  router.post("/login", auth.loginController.bind(auth));
  router.post("/logout", container.authenticate, auth.logoutController.bind(auth));

  // RF01 / RN-A6: públicas. Quem esqueceu a senha não tem sessão, e quem
  // clica no link pode estar em outro navegador.
  router.post(
    "/password-recovery",
    recovery.requestPasswordRecoveryController.bind(recovery),
  );
  router.post(
    "/password-recovery/confirm",
    recovery.confirmPasswordRecoveryController.bind(recovery),
  );

  // RF03: pedir exige sessão (só o dono troca o próprio e-mail); confirmar
  // é público, porque o clique vem do link no novo endereço.
  router.post(
    "/email-change",
    container.authenticate,
    recovery.requestEmailChangeController.bind(recovery),
  );
  router.post(
    "/email-change/confirm",
    recovery.confirmEmailChangeController.bind(recovery),
  );

  return router;
}
