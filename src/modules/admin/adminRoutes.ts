import { Router } from "express";
import { Container } from "../../shared/container";
import { authorize } from "../auth/middleware/authorize";
import { AccountRole } from "../auth/types/AccountRole";
import { advertiserVerificationAdminRoutes } from "../advertiser/advertiseVerificationRoutes";

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
  /**
   * @swagger
   * /api/v1/admin/administrators:
   *   post:
   *     tags: [Administração]
   *     summary: Cadastrar administrador (RF34)
   *     description: Não há cadastro público; o primeiro admin vem do script `seed:admin`.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/CreateAdmin" }
   *     responses:
   *       201: { description: Administrador criado }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       409: { $ref: "#/components/responses/Conflict" }
   */
  router.post("/administrators", admins.createController.bind(admins));
  /**
   * @swagger
   * /api/v1/admin/administrators:
   *   get:
   *     tags: [Administração]
   *     summary: Listar administradores (RF34)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
   *       - { in: query, name: pageSize, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
   *       - { in: query, name: active, schema: { type: string, enum: ["true", "false"] } }
   *     responses:
   *       200: { description: Página de administradores }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  router.get("/administrators", admins.listController.bind(admins));

  // RF22: own profile. Declared before the /:id routes on purpose.
  /**
   * @swagger
   * /api/v1/admin/administrators/me:
   *   patch:
   *     tags: [Administração]
   *     summary: Editar o próprio perfil de administrador (RF03)
   *     description: >
   *       Trocar a senha exige a atual e encerra todas as sessões (RN-A3).
   *       Declarada antes das rotas `/:id` de propósito, senão "me" seria
   *       capturado como id.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/UpdateOwnAdminProfile" }
   *     responses:
   *       200: { description: Perfil atualizado }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  router.patch(
    "/administrators/me",
    admins.updateOwnProfileController.bind(admins),
  );

  // RF20 / RN32: student accounts seen by the administrator
  /**
   * @swagger
   * /api/v1/admin/students:
   *   get:
   *     tags: [Administração]
   *     summary: Listar candidatos (RF32)
   *     description: >
   *       O administrador vê o **CPF completo** (Anexo A). Quem nunca pode
   *       ver é o anunciante (RNF03).
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
   *       - { in: query, name: pageSize, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
   *       - { in: query, name: active, schema: { type: string, enum: ["true", "false"] } }
   *     responses:
   *       200: { description: Página de candidatos }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   */
  router.get("/students", admins.listStudentsController.bind(admins));

  /**
   * @swagger
   * /api/v1/admin/administrators/{id}/deactivate:
   *   patch:
   *     tags: [Administração]
   *     summary: Desativar um administrador (RF34)
   *     description: >
   *       Nunca a si mesmo nem o último ativo. A checagem roda em transação
   *       com lock, então duas desativações simultâneas não deixam o sistema
   *       sem administrador. Desativar encerra as sessões da conta alvo.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200: { description: Administrador desativado }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   *       409:
   *         description: Já inativo, é a própria conta, ou é o último ativo
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   */
  router.patch(
    "/administrators/:id/deactivate",
    admins.deactivateController.bind(admins),
  );
  /**
   * @swagger
   * /api/v1/admin/administrators/{id}/reactivate:
   *   patch:
   *     tags: [Administração]
   *     summary: Reativar um administrador (RF34)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200: { description: Administrador reativado }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   *       409: { $ref: "#/components/responses/Conflict" }
   */
  router.patch(
    "/administrators/:id/reactivate",
    admins.reactivateController.bind(admins),
  );

  // RF33: manutenção de cursos. A leitura é pública e fica em
  // `courseRoutes`; aqui só o que exige administrador.
  /**
   * @swagger
   * /api/v1/admin/courses:
   *   post:
   *     tags: [Cursos]
   *     summary: Cadastrar curso (RF33)
   *     description: Nome único. O nome é aparado antes de comparar.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: "#/components/schemas/CreateCourse" }
   *     responses:
   *       201: { description: Curso criado }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       409: { $ref: "#/components/responses/Conflict" }
   */
  router.post("/courses", courses.createController.bind(courses));
  /**
   * @swagger
   * /api/v1/admin/courses/{id}:
   *   patch:
   *     tags: [Cursos]
   *     summary: Renomear curso (RF33)
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
   *           schema: { $ref: "#/components/schemas/UpdateCourse" }
   *     responses:
   *       200: { description: Curso renomeado }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   *       409: { $ref: "#/components/responses/Conflict" }
   */
  router.patch("/courses/:id", courses.renameController.bind(courses));
  /**
   * @swagger
   * /api/v1/admin/courses/{id}:
   *   delete:
   *     tags: [Cursos]
   *     summary: Excluir curso (RF33)
   *     description: >
   *       Só sai curso **sem vínculo**. Com formação (RF11) ou vaga (RF24)
   *       apontando para ele, responde 409 — a regra vale no service e na
   *       própria chave estrangeira.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       204: { description: Curso excluído }
   *       401: { $ref: "#/components/responses/Unauthorized" }
   *       403: { $ref: "#/components/responses/Forbidden" }
   *       404: { $ref: "#/components/responses/NotFound" }
   *       409:
   *         description: Curso em uso
   *         content:
   *           application/json:
   *             schema: { $ref: "#/components/schemas/Error" }
   */
  router.delete("/courses/:id", courses.deleteController.bind(courses));

  // RF30: fila e decisão de verificação de anunciantes. Sub-router próprio
  // (o dado é do anunciante, a montagem é do admin), em
  // /api/v1/admin/advertisers.
  router.use("/advertisers", advertiserVerificationAdminRoutes(container));

  return router;
  // Subtask 2 onwards: admin management, student accounts, CPF correction.
}
