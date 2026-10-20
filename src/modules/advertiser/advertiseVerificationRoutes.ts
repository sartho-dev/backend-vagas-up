import { Router } from "express";
import { Container } from "../../shared/container";
import { authorize } from "../auth/middleware/authorize";
import { AccountRole } from "../auth/types/AccountRole";

// RF30: rotas de verificação do ponto de vista do ADMIN. O controller vive
// no módulo advertiser porque o dado é do anunciante; a montagem é do admin.
// Este arquivo é importado por `adminRoutes.ts` e montado em
// `/api/v1/admin/advertisers`.
export function advertiserVerificationAdminRoutes(
  container: Container,
): Router {
  const router = Router();
  const verification = container.advertiserVerificationController;

  router.use(container.authenticate, authorize(AccountRole.ADMIN));

  /**
   * @swagger
   * /api/v1/admin/advertisers/verification-queue:
   *   get:
   *     tags: [Admin - Verificação]
   *     summary: Fila de verificação (RF30)
   *     description: >
   *       Anunciantes pendentes **que pediram verificação**, mais antigos
   *       primeiro. Pendente sem pedido (recém-cadastrado) não entra —
   *       senão a fila encheria de anunciantes que nem pediram nada.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, minimum: 1, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
   *     responses:
   *       200: { description: Fila paginada }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  router.get(
    "/verification-queue",
    verification.listPendingController.bind(verification),
  );

  /**
   * @swagger
   * /api/v1/admin/advertisers/{id}/cnpj-lookup:
   *   get:
   *     tags: [Admin - Verificação]
   *     summary: Consulta pública do CNPJ (RN-V2)
   *     description: >
   *       Consulta assistida. Nada do que volta daqui é gravado — a decisão
   *       é do admin, e o registro guarda só o método escolhido, nunca o
   *       relatório. Só vale para PJ: PF tem CPF, que a consulta pública
   *       não cobre (RN-V3).
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200: { description: Relatório da consulta }
   *       400: { description: Anunciante não é pessoa jurídica }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   */
  router.get(
    "/:id/cnpj-lookup",
    verification.cnpjLookupController.bind(verification),
  );

  /**
   * @swagger
   * /api/v1/admin/advertisers/{id}/verification:
   *   patch:
   *     tags: [Admin - Verificação]
   *     summary: Decidir a verificação (RF30, RNF07)
   *     description: >
   *       Verificar exige método compatível com o tipo — PJ só aceita
   *       `cnpj_lookup_email_domain` ou `cnpj_lookup_phone_call`; PF só
   *       aceita `video_call`. Recusar exige motivo. A decisão grava
   *       `verifiedBy`, `verifiedAt` e — na verificação — o método.
   *       Segundo admin que decidir recebe 409, não sobrescreve o primeiro.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             oneOf:
   *               - type: object
   *                 required: [decision, method]
   *                 properties:
   *                   decision: { type: string, enum: [verify] }
   *                   method:
   *                     type: string
   *                     enum:
   *                       - cnpj_lookup_email_domain
   *                       - cnpj_lookup_phone_call
   *                       - video_call
   *               - type: object
   *                 required: [decision, reason]
   *                 properties:
   *                   decision: { type: string, enum: [reject] }
   *                   reason: { type: string, minLength: 1, maxLength: 1000 }
   *     responses:
   *       204: { description: Decisão registrada }
   *       400: { description: Método incompatível com o tipo, ou motivo ausente }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   *       409: { description: Já verificado ou já recusado }
   */
  router.patch(
    "/:id/verification",
    verification.decideController.bind(verification),
  );

  /**
   * @swagger
   * /api/v1/admin/advertisers/{id}:
   *   get:
   *     tags: [Admin - Verificação]
   *     summary: Detalhe do anunciante para decisão (RF30)
   *     description: >
   *       Dados do anunciante + responsáveis ativos/inativos. Os e-mails dos
   *       responsáveis aparecem aqui para o admin conferir o domínio na
   *       consulta de CNPJ (RN-V2). O CPF do responsável nunca é exposto.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200: { description: Detalhe do anunciante }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   */
  router.get(
    "/:id",
    verification.getDetailForAdminController.bind(verification),
  );

  return router;
}
