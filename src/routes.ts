// routes/index.ts
import { Router } from "express";
import { studentRoutes } from "./modules/student/studentRoutes";
import { authRoutes } from "./modules/auth/authRoutes";
import { adminRoutes } from "./modules/admin/adminRoutes";
import { courseRoutes } from "./modules/course/courseRoutes";
import { Container } from "./shared/container";

export default function routesMain(container: Container): Router {
  const router = Router();

  router.use("/api/v1/students", studentRoutes(container));
  router.use("/api/v1/auth", authRoutes(container));
  router.use("/api/v1/courses", courseRoutes(container));
  router.use("/api/v1/admin", adminRoutes(container));

  return router;
}
