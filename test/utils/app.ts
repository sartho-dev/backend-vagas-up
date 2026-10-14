import supertest from "supertest";
import { DataSource } from "typeorm";
import { Application } from "express";
import { App } from "@/App";
import { buildContainer, Container } from "@/shared/container";
import { AppDataSource } from "@/shared/database/data-source";
import { FakePasswordHasher } from "./FakePasswordHasher";
import { TestEmailSender } from "./TestEmailSender";

export type TestContext = {
  app: Application;
  // O supertest mudou os tipos: o retorno virou TestAgent<Test>, não
  // SuperTest<Test>. Usar ReturnType evita depender do nome do tipo.
  request: ReturnType<typeof supertest>;
  container: Container;
  dataSource: DataSource;
  hasher: FakePasswordHasher;
  emailSender: TestEmailSender;
};

export async function createTestContext(): Promise<TestContext> {
  const hasher = new FakePasswordHasher();
  const emailSender = new TestEmailSender();

  // Inicializa o banco de dados se ainda não estiver inicializado
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const container = buildContainer({
    passwordHasher: hasher,
  });

  const app = new App(container);

  return {
    app: app.app,
    request: supertest(app.app),
    container,
    dataSource: AppDataSource,
    hasher,
    emailSender,
  };
}

export async function loginAs(
  ctx: TestContext,
  email: string,
  password: string,
): Promise<{ token: string; accountId: string; role: string }> {
  const res = await ctx.request
    .post("/api/v1/auth/login")
    .send({ email, password })
    .expect(200);

  return {
    token: res.body.data.token,
    accountId: res.body.data.accountId,
    role: res.body.data.role,
  };
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
