import { Router } from "express";
import { Container } from "../../shared/container";
import { authorize } from "../auth/middleware/authorize";
import { AccountRole } from "../auth/types/AccountRole";

// RF24 a RF29: tudo aqui é do RESPONSÁVEL autenticado, sobre as vagas do
// anunciante dele. A página pública da vaga e a busca são a task 15 e vão
// montar rotas próprias, sem autenticação.
export function vacancyRoutes(container: Container): Router {
  const router = Router();
  const vacancies = container.vacancyController;

  router.use(container.authenticate, authorize(AccountRole.RESPONSIBLE));

  /**
   * @swagger
   * /api/v1/vacancies:
   *   post:
   *     tags: [Vagas]
   *     summary: Criar rascunho de vaga (RF24)
   *     description: >
   *       A vaga nasce em `rascunho`, sem valor e sem data de publicação, e
   *       nesse estado tudo é editável. Nada aqui depende de verificação ou
   *       pagamento: a decisão entre gratuita e paga acontece no envio.
   *
   *       **RN-VG4 — atenção à unidade da carga horária:** o limite é
   *       semanal para estágio (30 h) e emprego (44 h), mas **diário** para
   *       jovem aprendiz (6 h). `workHours` guarda o número na unidade do
   *       tipo, e a resposta devolve `workHoursUnit` junto.
   *
   *       **RN-VG9:** a vaga não define faixa de idade — anúncio com limite
   *       de idade é prática discriminatória (Lei 9.029/1995). Só existe
   *       `requiresAdult`, e apenas quando a lei proíbe menores (trabalho
   *       noturno, perigoso ou insalubre). Qualquer outro campo de idade é
   *       recusado com 400.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/CreateVacancy" }
   *     responses:
   *       201: { description: Rascunho criado }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  router.post("/", vacancies.createController);

  /**
   * @swagger
   * /api/v1/vacancies:
   *   get:
   *     tags: [Vagas]
   *     summary: Listar as vagas do anunciante
   *     description: >
   *       Todas as situações, da mais recente para a mais antiga. O
   *       anunciante vem do vínculo do responsável autenticado — não há
   *       como listar as vagas de outro.
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Vagas do anunciante }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  router.get("/", vacancies.listController);

  /**
   * @swagger
   * /api/v1/vacancies/{id}:
   *   get:
   *     tags: [Vagas]
   *     summary: Ver uma vaga, como o candidato a verá (RF29)
   *     description: >
   *       É a leitura que alimenta a tela de revisão. Vaga de outro
   *       anunciante responde **404**, não 403: a posse é filtro de banco,
   *       então nesse escopo ela não existe — e um 403 confirmaria que
   *       aquele id existe em algum lugar.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200: { description: Vaga }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   */
  router.get("/:id", vacancies.getController);

  /**
   * @swagger
   * /api/v1/vacancies/{id}:
   *   patch:
   *     tags: [Vagas]
   *     summary: Editar vaga não publicada (RN-P5)
   *     description: >
   *       **Só em `rascunho` ou `aguardando_pagamento`.** Vaga publicada
   *       responde **409**: os dados foram conferidos na revisão (RF29) e
   *       os candidatos se inscreveram com base neles. Erro encontrado
   *       depois da publicação se resolve encerrando a vaga e publicando
   *       outra. É 409 e não 403 porque a rota é permitida — o que não
   *       aceita a operação é o estado da vaga.
   *
   *       `situation`, `value` e `free` não são campos editáveis; mandá-los
   *       dá 400, não uma publicação silenciosa.
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
   *           schema: { $ref: "#/components/schemas/PatchVacancy" }
   *     responses:
   *       200: { description: Vaga atualizada }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   *       409:
   *         description: Vaga publicada não pode ser editada
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   */
  router.patch("/:id", vacancies.updateController);

  /**
   * @swagger
   * /api/v1/vacancies/{id}/submit:
   *   post:
   *     tags: [Vagas]
   *     summary: Enviar a vaga para publicação (RF29)
   *     description: >
   *       O corpo exige `confirmed: true` — é a **dupla confirmação** da
   *       RF29 escrita como regra do sistema, não como detalhe de tela: sem
   *       ela, um POST acidental publicaria a vaga.
   *
   *       O que acontece aqui:
   *
   *       - **RN-P1:** a primeira vaga do anunciante é gratuita. Vai direto
   *         para `aberta`, com `publishedAt` e `expiresAt` (60 dias, RN-P4).
   *       - **RN-P2 / RN-V4:** as demais exigem anunciante **verificado** —
   *         403 se não for. A barreira é antes do PIX, para ninguém pagar e
   *         ser recusado depois.
   *       - **RN-P8:** o preço é **copiado** da tabela neste instante. A
   *         vaga carrega a cópia; alteração de preço depois não a alcança.
   *       - **RN-P3:** a vaga paga para em `aguardando_pagamento` e só abre
   *         quando o administrador confirma o PIX (task 14).
   *       - **RN-V3a:** anunciante pessoa física tem no máximo 3 vagas
   *         abertas ao mesmo tempo — 409 ao estourar.
   *       - **RN-VG3:** o prazo é revalidado agora, contra o momento do
   *         envio, porque o rascunho pode ter ficado semanas parado.
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
   *           schema: { $ref: "#/components/schemas/SubmitVacancy" }
   *     responses:
   *       200: { description: Vaga enviada (aberta, se gratuita) }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403:
   *         description: Anunciante não verificado ou inativo
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   *       404: { $ref: "#/components/responses/NotFound" }
   *       409:
   *         description: Vaga não é rascunho, ou limite da pessoa física
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   */
  router.post("/:id/submit", vacancies.submitController);

  /**
   * @swagger
   * /api/v1/vacancies/{id}/close:
   *   post:
   *     tags: [Vagas]
   *     summary: Encerrar a vaga (RF25)
   *     description: >
   *       **Encerrada é final e não reabre** (RN-VG1). Para continuar
   *       contratando, publica-se outra vaga, com novo pagamento. O
   *       anunciante encerra quando escolhe o candidato; o cancelamento das
   *       candidaturas em andamento e o aviso aos candidatos (RN-VG2) ficam
   *       para a task 16, que cria a tabela.
   *
   *       Rascunho não é encerrado, é excluído — 409.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200: { description: Vaga encerrada }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   *       409:
   *         description: Vaga já encerrada, ou é rascunho
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   */
  router.post("/:id/close", vacancies.closeController);

  /**
   * @swagger
   * /api/v1/vacancies/{id}:
   *   delete:
   *     tags: [Vagas]
   *     summary: Excluir vaga nunca publicada (RN-VG6)
   *     description: >
   *       Só se exclui vaga que **nunca foi publicada**: rascunho e vaga
   *       parada em aguardando pagamento. Qualquer vaga com `publishedAt`
   *       responde 409, inclusive a já encerrada.
   *
   *       O critério é "nunca publicada" e não "não está aberta" por causa
   *       da **RN-P1**: o direito à vaga gratuita é gravado na linha da
   *       vaga, então apagar a linha o devolveria — bastaria publicar a
   *       gratuita, encerrá-la e excluí-la para ganhar outra. Uma vaga que
   *       esteve no ar também pode ter recebido candidatura.
   *
   *       A RN-VG6 completa ("com candidaturas, só encerrada") depende da
   *       tabela de candidaturas, que é a task 16.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       204: { description: Vaga excluída }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   *       409:
   *         description: Vaga já publicada não é excluída
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   */
  router.delete("/:id", vacancies.deleteController);

  return router;
}
