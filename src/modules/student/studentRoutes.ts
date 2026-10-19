import { Router } from "express";
import { Container } from "../../shared/container";
import { authorize } from "../auth/middleware/authorize";
import { AccountRole } from "../auth/types/AccountRole";

export function studentRoutes(container: Container): Router {
  const router = Router();
  const students = container.studentController;
  const formations = container.formationController;

  // RF10: cadastro é público.
  /**
   * @swagger
   * /api/v1/students:
   *   post:
   *     tags: [Candidato]
   *     summary: Cadastro de candidato (RF10)
   *     description: >
   *       Público. Idade mínima de 14 anos (RN-C1). A visibilidade nasce
   *       `oculto` e menor de 18 não pode escolher `publico` (RN-C9).
   *       Telefone é opcional, e cada número carrega a marca de WhatsApp
   *       (RN-C11). Exige aceite dos termos e da política de privacidade.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/CreateStudent" }
   *     responses:
   *       201: { description: Candidato cadastrado }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       409:
   *         description: CPF ou e-mail já em uso (RN-A7)
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   */
  router.post("/", students.createController.bind(students));

  // RF02 / Anexo A: tudo sob /me exige sessão de CANDIDATO. O authorize não
  // pode ficar no router inteiro porque o cadastro acima é público — então
  // vai num sub-router, aplicado uma vez, para nenhuma rota nova de perfil
  // esquecer. Sem ele, um token de admin alcançaria o service do candidato.
  const me = Router();
  me.use(container.authenticate, authorize(AccountRole.STUDENT));

  /**
   * @swagger
   * /api/v1/students/me:
   *   get:
   *     tags: [Candidato]
   *     summary: Ler o próprio perfil (RF03)
   *     description: Devolve o CPF **completo** — o dono vê o próprio (Anexo A).
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Perfil do candidato }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  me.get("/", students.getOwnProfileController.bind(students));
  /**
   * @swagger
   * /api/v1/students/me:
   *   patch:
   *     tags: [Candidato]
   *     summary: Editar o próprio perfil (RF03, RF12, RF13)
   *     description: >
   *       Trocar o e-mail **não** passa por aqui — use
   *       `POST /api/v1/auth/email-change`, que exige confirmação pelo novo
   *       endereço. O link de currículo aceita só https e domínios
   *       permitidos (RN-C10).
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/UpdateStudent" }
   *     responses:
   *       200: { description: Perfil atualizado }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403:
   *         description: >
   *           Token de outro perfil, ou menor de 18 tentando visibilidade
   *           `publico` (RN-C9).
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   */
  me.patch("/", students.updateOwnProfileController.bind(students));
  /**
   * @swagger
   * /api/v1/students/me/password:
   *   patch:
   *     tags: [Candidato]
   *     summary: Trocar a própria senha (RF03, RN-A5)
   *     description: >
   *       Exige a senha atual e **encerra todas as sessões**, inclusive a
   *       que fez a requisição (RN-A3). Senha atual errada responde 400, e
   *       não 401, para o cliente não confundir com sessão expirada.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/ChangePassword" }
   *     responses:
   *       204: { description: Senha trocada; todas as sessões encerradas }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  me.patch("/password", students.changePasswordController.bind(students));

  // RF11: formações do próprio candidato. Ficam sob /me de propósito — o
  // dono vem da sessão, então não existe caminho para alcançar a formação
  // de outra pessoa.
  /**
   * @swagger
   * /api/v1/students/me/formations:
   *   get:
   *     tags: [Formações]
   *     summary: Listar as próprias formações (RF11)
   *     description: Zero formações é estado válido — o cadastro não exige nenhuma.
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Formações do candidato }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  me.get("/formations", formations.listController.bind(formations));
  /**
   * @swagger
   * /api/v1/students/me/formations:
   *   post:
   *     tags: [Formações]
   *     summary: Registrar formação (RF11)
   *     description: >
   *       O curso é opcional (ensino médio não tem curso do catálogo). A
   *       data de fim não pode ser anterior à de início, e precisa estar
   *       vazia enquanto a formação está em andamento.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/CreateFormation" }
   *     responses:
   *       201: { description: Formação registrada }
   *       400:
   *         description: Datas inconsistentes ou curso inexistente
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  me.post("/formations", formations.createController.bind(formations));
  /**
   * @swagger
   * /api/v1/students/me/formations/{id}:
   *   patch:
   *     tags: [Formações]
   *     summary: Editar uma formação (RF11)
   *     description: >
   *       Edição parcial, mas as regras de data são revalidadas sobre o
   *       registro inteiro: mudar só a situação para "em andamento" sem
   *       limpar a data de fim é recusado.
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
   *           schema: { $ref: "#/components/schemas/UpdateFormation" }
   *     responses:
   *       200: { description: Formação atualizada }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404:
   *         description: >
   *           Não existe entre as formações do dono da sessão. Formação de
   *           outro candidato cai aqui, e não em 403, para não confirmar que
   *           o id existe.
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   */
  me.patch("/formations/:id", formations.updateController.bind(formations));
  /**
   * @swagger
   * /api/v1/students/me/formations/{id}:
   *   delete:
   *     tags: [Formações]
   *     summary: Remover uma formação (RF11)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       204: { description: Formação removida }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   */
  me.delete("/formations/:id", formations.deleteController.bind(formations));

  router.use("/me", me);

  return router;
}
