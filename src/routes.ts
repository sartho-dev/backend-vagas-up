// routes/index.ts
import { Router } from "express";
import { studentRoutes } from "./modules/student/studentRoutes";
import { authRoutes } from "./modules/auth/authRoutes";
import { adminRoutes } from "./modules/admin/adminRoutes";
import { courseRoutes } from "./modules/course/courseRoutes";
import { advertiserRoutes } from "./modules/advertiser/advertiserRoutes";
import { publicVacancyRoutes } from "./modules/vacancy/publicVacancyRoutes";
import { vacancyRoutes } from "./modules/vacancy/vacancyRoutes";
import { Container } from "./shared/container";

export default function routesMain(container: Container): Router {
  const router = Router();

  router.use("/api/v1/students", studentRoutes(container));
  router.use("/api/v1/auth", authRoutes(container));
  router.use("/api/v1/advertisers", advertiserRoutes(container));
  // RF14: a busca pública vem ANTES das rotas autenticadas de vaga, e num
  // prefixo próprio. Pendurá-la em `/api/v1/vacancies` a colocaria sob o
  // `authorize(RESPONSIBLE)` daquele router e ela deixaria de ser pública.
  router.use("/api/v1/public/vacancies", publicVacancyRoutes(container));
  router.use("/api/v1/vacancies", vacancyRoutes(container));
  router.use("/api/v1/courses", courseRoutes(container));
  router.use("/api/v1/admin", adminRoutes(container));

  return router;
}
