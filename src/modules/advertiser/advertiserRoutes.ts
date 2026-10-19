import { Router } from "express";
import { Container } from "../../shared/container";
import { authorize } from "../auth/middleware/authorize";
import { AccountRole } from "../auth/types/AccountRole";

export function advertiserRoutes(container: Container): Router {
  const router = Router();
  const advertisers = container.advertiserController;

  /**
   * @swagger
   * /api/v1/advertisers:
   *   post:
   *     tags: [Anunciante]
   *     summary: Cadastrar anunciante e primeiro responsável (RF20)
   *     description: >
   *       Público. O anunciante nasce com verificação `pendente` (RN-V1) e,
   *       até ser verificado, só publica a vaga gratuita (RN-V4). O
   *       documento é validado pelo dígito verificador: CNPJ para PJ, CPF
   *       para PF. Anunciante e responsável nascem na mesma transação.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/RegisterAdvertiser" }
   *     responses:
   *       201: { description: Anunciante e responsável criados }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       409:
   *         description: Documento ou e-mail já cadastrado
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   */
  router.post("/", advertisers.registerController.bind(advertisers));

  /**
   * @swagger
   * /api/v1/advertisers/invites/accept:
   *   post:
   *     tags: [Anunciante]
   *     summary: Aceitar convite de responsável (RF22)
   *     description: >
   *       Público: quem aceita ainda não tem conta. O convidado define a
   *       própria senha. O link vale 72 h e um uso. A unicidade do e-mail
   *       (RN-A7) é conferida de novo aqui — alguém pode tê-lo cadastrado
   *       entre o convite e o aceite.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/AcceptInvite" }
   *     responses:
   *       201: { description: Responsável criado }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       409: { $ref: "#/components/responses/Conflict" }
   */
  router.post(
    "/invites/accept",
    advertisers.acceptInviteController.bind(advertisers),
  );

  // Daqui para baixo: só responsável, e sempre sobre o PRÓPRIO anunciante.
  // O vínculo vem da sessão, então não há como alcançar outro anunciante.
  const me = Router();
  me.use(container.authenticate, authorize(AccountRole.RESPONSIBLE));

  /**
   * @swagger
   * /api/v1/advertisers/me:
   *   get:
   *     tags: [Anunciante]
   *     summary: Ler os dados do próprio anunciante (RF23)
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Dados do anunciante }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  me.get("/", advertisers.getOwnController.bind(advertisers));

  /**
   * @swagger
   * /api/v1/advertisers/me:
   *   patch:
   *     tags: [Anunciante]
   *     summary: Editar o próprio anunciante (RF23)
   *     description: >
   *       Tipo e documento não podem ser alterados — são a identidade do
   *       anunciante. **Alterar o nome de exibição ou a razão social de um
   *       anunciante verificado o devolve para `pendente`**: o selo foi
   *       concedido àquele nome, senão bastaria ser verificado como padaria
   *       e virar financeira.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/UpdateAdvertiser" }
   *     responses:
   *       200: { description: Anunciante atualizado }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  me.patch("/", advertisers.updateOwnController.bind(advertisers));

  /**
   * @swagger
   * /api/v1/advertisers/me/responsibles:
   *   get:
   *     tags: [Anunciante]
   *     summary: Listar responsáveis do próprio anunciante (RF22)
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Responsáveis do anunciante }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  me.get(
    "/responsibles",
    advertisers.listResponsiblesController.bind(advertisers),
  );

  /**
   * @swagger
   * /api/v1/advertisers/me/responsibles/invite:
   *   post:
   *     tags: [Anunciante]
   *     summary: Convidar outro responsável (RF22)
   *     description: Link de 72 h, uso único; o convidado define a senha.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/InviteResponsible" }
   *     responses:
   *       204: { description: Convite enviado }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       409: { $ref: "#/components/responses/Conflict" }
   */
  me.post(
    "/responsibles/invite",
    advertisers.inviteResponsibleController.bind(advertisers),
  );

  /**
   * @swagger
   * /api/v1/advertisers/me/responsibles/{id}/deactivate:
   *   patch:
   *     tags: [Anunciante]
   *     summary: Desativar um responsável (RN-VG8)
   *     description: >
   *       O anunciante precisa ter sempre ao menos um responsável ativo —
   *       para encerrar, desativa-se o anunciante. A checagem roda em
   *       transação com lock, então duas desativações simultâneas não
   *       deixam o anunciante sem ninguém. Também não é possível desativar
   *       a própria conta.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       204: { description: Responsável desativado }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   *       409:
   *         description: Já inativo, é a própria conta, ou é o último ativo
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   */
  me.patch(
    "/responsibles/:id/deactivate",
    advertisers.deactivateResponsibleController.bind(advertisers),
  );

  router.use("/me", me);

  return router;
}
