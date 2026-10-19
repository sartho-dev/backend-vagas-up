import { Router } from "express";
import { Container } from "../../shared/container";

// Só a leitura mora aqui, e é pública (sem login).
//
// As rotas de escrita ficam em `adminRoutes`, sob `/api/v1/admin/courses`.
// Isso mantém a invariante de que TUDO sob /api/v1/admin é de administrador,
// garantida por um único `authorize` no topo daquele router — em vez de
// espalhar a checagem rota a rota aqui.
export function courseRoutes(container: Container): Router {
  const router = Router();
  const courses = container.courseController;

  /**
   * @swagger
   * /api/v1/courses:
   *   get:
   *     tags: [Cursos]
   *     summary: Listar cursos (RF33)
   *     description: >
   *       Público. Candidato precisa da lista para declarar formação (RF11)
   *       e o responsável, para indicar o curso da vaga (RF24).
   *       Ordenado por nome.
   *     responses:
   *       200:
   *         description: Lista de cursos
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status: { type: string, enum: [success] }
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id: { type: string, format: uuid }
   *                       name: { type: string }
   */
  router.get("/", courses.listController.bind(courses));

  return router;
}
