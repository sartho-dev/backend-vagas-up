import { Router } from "express";
import { Container } from "../../shared/container";
import { authorize } from "../auth/middleware/authorize";
import { AccountRole } from "../auth/types/AccountRole";

// RF37: a fila de pagamentos do administrador. Importado por
// `adminRoutes.ts` e montado em `/api/v1/admin`.
//
// Não há rota de "criar pagamento": a linha de pagamento nasce da DECISÃO
// do admin (confirmar ou recusar), nunca de um envio do anunciante. O
// sistema não recebe dinheiro nem comprovante (RN-P7) — o PIX acontece
// fora do site e o que se registra aqui é a conferência.
export function paymentAdminRoutes(container: Container): Router {
  const router = Router();
  const payments = container.paymentController;

  router.use(container.authenticate, authorize(AccountRole.ADMIN));

  /**
   * @swagger
   * /api/v1/admin/payments/queue:
   *   get:
   *     tags: [Administração]
   *     summary: Fila de vagas aguardando pagamento (RF37)
   *     description: >
   *       São as **vagas** em `aguardando_pagamento`, da mais antiga para a
   *       mais recente: quem enviou antes espera menos. Não há linha de
   *       pagamento antes da decisão do administrador (RN-P7), então a vaga
   *       é a fila.
   *
   *       Cada item traz o **código de referência**, que é por onde se acha
   *       o PIX no extrato (RN-P3), e o estado de verificação do
   *       anunciante: uma vaga que chegou aqui e perdeu a verificação
   *       depois não pode ser confirmada (RN-P2).
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, minimum: 1, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
   *     responses:
   *       200: { description: Fila de pagamentos }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  router.get("/payments/queue", payments.queueController);

  /**
   * @swagger
   * /api/v1/admin/payments/{vacancyId}/confirm:
   *   post:
   *     tags: [Administração]
   *     summary: Confirmar o PIX e publicar a vaga (RF37)
   *     description: >
   *       Registra o pagamento e leva a vaga para `aberta`, com
   *       `publishedAt` e `expiresAt` (60 dias, RN-P4). A validade conta
   *       daqui, não do envio: entre os dois podem passar dias.
   *
   *       **RN-P8:** o valor gravado é o da **linha da vaga**, copiado no
   *       envio. A tabela de preços não é relida — se o preço mudou depois
   *       do envio, vale o que o anunciante pagou.
   *
   *       **Reconferência antes de publicar.** O que valia no envio pode
   *       não valer mais, então o anunciante tem de estar ativo e ainda
   *       **verificado** (RN-P2; a RF23 devolve para pendente quem troca de
   *       nome), e a pessoa física não pode passar de 3 vagas abertas
   *       (RN-V3a). Qualquer um desses responde 409.
   *
   *       Um pagamento por vaga, para sempre: confirmar duas vezes é 409,
   *       garantido pelo índice único e não por uma checagem antes do
   *       INSERT, que teria janela entre o SELECT e a escrita.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: vacancyId
   *         required: true
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/ConfirmPayment" }
   *     responses:
   *       201: { description: Pagamento confirmado e vaga publicada }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   *       409:
   *         description: >
   *           Vaga não está aguardando pagamento, já tem pagamento, ou o
   *           anunciante não está mais publicável
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   */
  router.post("/payments/:vacancyId/confirm", payments.confirmController);

  /**
   * @swagger
   * /api/v1/admin/payments/{vacancyId}/reject:
   *   post:
   *     tags: [Administração]
   *     summary: Recusar o pagamento e encerrar a vaga (RF37, RN-P6)
   *     description: >
   *       **A recusa é terminal:** a vaga vai para `encerrada` e não reabre.
   *       O anunciante publica outra — é o mesmo caminho que a RN-P5 dá para
   *       qualquer erro achado depois do envio, e é o que o `vaga_id` único
   *       do pagamento permite.
   *
   *       `moneyReceived` escolhe entre as duas recusas da **RN-P6** e não
   *       tem padrão: o administrador tem de olhar o extrato e dizer, porque
   *       a resposta decide se alguém vai devolver dinheiro.
   *
   *       - `false` → pagamento `recusado`: o PIX não conferiu (não chegou,
   *         valor errado). Não há o que devolver.
   *       - `true` → pagamento `reembolsado`: o PIX chegou, mas a vaga não
   *         será publicada, e o valor volta. O reembolso só existe **antes**
   *         da publicação; vaga encerrada por denúncia procedente não
   *         reembolsa.
   *
   *       O PIX de volta é feito à mão, fora do site — aqui fica o registro
   *       de que é devido. O motivo é obrigatório e vai no e-mail ao
   *       anunciante.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: vacancyId
   *         required: true
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/RejectPayment" }
   *     responses:
   *       201: { description: Pagamento recusado e vaga encerrada }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   *       409:
   *         description: Vaga não está aguardando pagamento, ou já tem pagamento
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   */
  router.post("/payments/:vacancyId/reject", payments.rejectController);

  /**
   * @swagger
   * /api/v1/admin/payments:
   *   get:
   *     tags: [Administração]
   *     summary: Pagamentos por período (RF37)
   *     description: >
   *       Pagamentos já decididos, do mais recente para o mais antigo.
   *       `from` e `to` são opcionais e filtram por data da decisão.
   *
   *       `confirmedTotal` é a soma das linhas **confirmadas do período
   *       inteiro**, calculada no banco — não a soma da página, que daria um
   *       número diferente a cada página.
   *
   *       **RN-P7:** não há comprovante aqui. O sistema registra valor,
   *       data, código de referência e quem decidiu, e nada mais.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: query
   *         name: from
   *         schema: { type: string, format: date-time }
   *       - in: query
   *         name: to
   *         schema: { type: string, format: date-time }
   *       - in: query
   *         name: situation
   *         schema:
   *           type: string
   *           enum: [confirmado, recusado, reembolsado]
   *       - in: query
   *         name: page
   *         schema: { type: integer, minimum: 1, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
   *     responses:
   *       200: { description: Pagamentos do período }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  router.get("/payments", payments.listController);

  return router;
}
