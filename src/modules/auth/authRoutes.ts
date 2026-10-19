import { Router } from "express";
import { Container } from "../../shared/container";

export function authRoutes(container: Container): Router {
  const router = Router();
  const auth = container.authController;
  const recovery = container.recoveryController;

  /**
   * @swagger
   * /api/v1/auth/login:
   *   post:
   *     tags: [Auth]
   *     summary: Entrar (RF01)
   *     description: >
   *       Devolve um token opaco. Após 5 falhas seguidas no mesmo e-mail o
   *       login fica bloqueado por 15 min (RN-A4) — e a resposta do bloqueio
   *       é idêntica à de senha errada, de propósito.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/Login" }
   *     responses:
   *       200:
   *         description: Sessão criada
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status: { type: string, enum: [success] }
   *                 data:
   *                   type: object
   *                   properties:
   *                     token: { type: string }
   *                     accountId: { type: string, format: uuid }
   *                     role: { type: string, enum: [student, responsible, admin] }
   *                     idleTimeoutMinutes: { type: integer }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401:
   *         description: >
   *           "E-mail ou senha inválidos" — mesma resposta para e-mail
   *           inexistente, senha errada, conta inativa e conta bloqueada
   *           (RN-A1, RN-A4).
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   */
  router.post("/login", auth.loginController.bind(auth));
  /**
   * @swagger
   * /api/v1/auth/logout:
   *   post:
   *     tags: [Auth]
   *     summary: Sair (RF01)
   *     description: Encerra a sessão imediatamente (RN-A3).
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       204: { description: Sessão encerrada }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   */
  router.post("/logout", container.authenticate, auth.logoutController.bind(auth));

  // RF01 / RN-A6: públicas. Quem esqueceu a senha não tem sessão, e quem
  // clica no link pode estar em outro navegador.
  /**
   * @swagger
   * /api/v1/auth/password-recovery:
   *   post:
   *     tags: [Auth]
   *     summary: Pedir link de recuperação de senha (RN-A6)
   *     description: >
   *       Responde **204 sempre**, exista ou não o e-mail. Um 404 aqui diria
   *       ao atacante quais endereços estão cadastrados. O link vale 30 min
   *       e um uso; pedir de novo invalida o anterior.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/RequestPasswordRecovery" }
   *     responses:
   *       204: { description: Pedido recebido (não revela se o e-mail existe) }
   *       400: { $ref: "#/components/responses/BadRequest" }
   */
  router.post(
    "/password-recovery",
    recovery.requestPasswordRecoveryController.bind(recovery),
  );
  /**
   * @swagger
   * /api/v1/auth/password-recovery/confirm:
   *   post:
   *     tags: [Auth]
   *     summary: Redefinir a senha com o link recebido (RN-A6)
   *     description: >
   *       Encerra **todas** as sessões da conta (RN-A3). Token inválido,
   *       expirado e já usado respondem igual.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/ConfirmPasswordRecovery" }
   *     responses:
   *       204: { description: Senha redefinida e sessões encerradas }
   *       400: { $ref: "#/components/responses/BadRequest" }
   */
  router.post(
    "/password-recovery/confirm",
    recovery.confirmPasswordRecoveryController.bind(recovery),
  );

  // RF03: pedir exige sessão (só o dono troca o próprio e-mail); confirmar
  // é público, porque o clique vem do link no novo endereço.
  /**
   * @swagger
   * /api/v1/auth/email-change:
   *   post:
   *     tags: [Auth]
   *     summary: Pedir troca de e-mail (RF03)
   *     description: >
   *       O link de confirmação vai para o endereço **novo**, nunca para o
   *       atual — é isso que prova que a pessoa controla a caixa para a qual
   *       a conta vai passar. O e-mail só muda após a confirmação.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/RequestEmailChange" }
   *     responses:
   *       204: { description: Link enviado ao novo endereço }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       409: { $ref: "#/components/responses/Conflict" }
   */
  router.post(
    "/email-change",
    container.authenticate,
    recovery.requestEmailChangeController.bind(recovery),
  );
  /**
   * @swagger
   * /api/v1/auth/email-change/confirm:
   *   post:
   *     tags: [Auth]
   *     summary: Confirmar o novo e-mail (RF03)
   *     description: >
   *       Público: o clique vem do link e pode acontecer em outro navegador.
   *       A unicidade (RN-A7) é conferida **de novo** aqui — outra conta pode
   *       ter registrado o endereço entre o pedido e a confirmação.
   *       Encerra todas as sessões.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/ConfirmEmailChange" }
   *     responses:
   *       204: { description: E-mail trocado e sessões encerradas }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       409: { $ref: "#/components/responses/Conflict" }
   */
  router.post(
    "/email-change/confirm",
    recovery.confirmEmailChangeController.bind(recovery),
  );

  return router;
}
