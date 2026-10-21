import { Router } from "express";
import { Container } from "../../shared/container";
import { authorize } from "../auth/middleware/authorize";
import { AccountRole } from "../auth/types/AccountRole";

// RF39 e CONFIGURACAO: só administrador. Importado por `adminRoutes.ts` e
// montado em `/api/v1/admin`.
//
// Não há rota pública aqui de propósito. O responsável não consulta a tabela
// de preços: ele vê o valor na tela de pagamento da vaga (RF28), que a task
// 13 preenche com a cópia feita no envio — ler o preço "ao vivo" na tela
// seria a porta para mostrar um valor diferente do cobrado (RN-P8).
export function pricingAdminRoutes(container: Container): Router {
  const router = Router();
  const pricing = container.pricingController;

  router.use(container.authenticate, authorize(AccountRole.ADMIN));

  /**
   * @swagger
   * /api/v1/admin/vacancy-prices:
   *   get:
   *     tags: [Administração]
   *     summary: Tabela de preços das vagas (RF39)
   *     description: >
   *       Uma linha por tipo de vaga, sempre as três. Traz quem alterou e
   *       quando (RNF07); `updatedBy` nulo é a carga inicial da migration.
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Preços por tipo de vaga }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  router.get("/vacancy-prices", pricing.listPricesController);

  /**
   * @swagger
   * /api/v1/admin/vacancy-prices/{type}:
   *   patch:
   *     tags: [Administração]
   *     summary: Alterar o preço de um tipo de vaga (RF39)
   *     description: >
   *       **RN-P8:** o novo valor vale só para vagas enviadas para pagamento
   *       depois da alteração. A vaga guarda o valor do momento do envio, e
   *       é esse que aparece no PIX — alterar o preço aqui não mexe em vaga
   *       nenhuma. Não há rota de criar nem de excluir: as três linhas
   *       nascem com a migration.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: type
   *         required: true
   *         schema: { type: string, enum: [estagio, emprego, jovem_aprendiz] }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/UpdateVacancyPrice" }
   *     responses:
   *       200: { description: Preço atualizado }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  router.patch("/vacancy-prices/:type", pricing.updatePriceController);

  /**
   * @swagger
   * /api/v1/admin/settings:
   *   get:
   *     tags: [Administração]
   *     summary: Configurações do sistema
   *     description: >
   *       Devolve **todas** as chaves conhecidas, configuradas ou não — a
   *       não configurada vem com `value: null`. Hoje são o link da
   *       comunidade de anunciantes (RF41), o contato de "Anuncie aqui"
   *       (RF40) e a chave PIX que o anunciante vê na tela de pagamento da
   *       vaga (RF28).
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Configurações }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  router.get("/settings", pricing.listSettingsController);

  /**
   * @swagger
   * /api/v1/admin/settings/{key}:
   *   patch:
   *     tags: [Administração]
   *     summary: Alterar uma configuração
   *     description: >
   *       `value: null` apaga a configuração, que volta ao estado "não
   *       configurada". Cada chave tem sua regra: o link da comunidade
   *       exige `https://`; o contato é texto livre; a chave PIX é texto
   *       livre não vazio, porque pode ser CPF, CNPJ, e-mail, telefone ou
   *       chave aleatória.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema:
   *           type: string
   *           enum: [advertiser_community_url, sponsorship_contact, pix_key]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/UpdateSetting" }
   *     responses:
   *       200: { description: Configuração atualizada }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  router.patch("/settings/:key", pricing.updateSettingController);

  return router;
}
