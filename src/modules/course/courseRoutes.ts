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

  router.get("/", courses.listController.bind(courses));

  return router;
}
