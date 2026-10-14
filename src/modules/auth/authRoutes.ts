import { Router } from "express";
import { Container } from "../../shared/container";

export function authRoutes(container: Container): Router {
  const router = Router();

  router.post(
    "/login",
    container.authController.loginController.bind(container.authController),
  );

  router.post(
    "/logout",
    container.authenticate,
    container.authController.logoutController.bind(container.authController),
  );

  return router;
}
