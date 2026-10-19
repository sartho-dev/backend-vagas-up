import swaggerJsdoc from "swagger-jsdoc";
import path from "path";
import {
  commonResponses,
  errorSchema,
  generatedSchemas,
} from "./components";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "EstagiaAqui API",
      version: "1.0.0",
      description:
        "API da plataforma de vagas de emprego e estágio.\n\n" +
        "**Autenticação:** a API não usa JWT. O login devolve um token " +
        "opaco de 256 bits, enviado como `Authorization: Bearer <token>`. " +
        "Ele não é decodificável — `accountId`, `role` e " +
        "`idleTimeoutMinutes` vêm no corpo da resposta do login.\n\n" +
        "A sessão expira em 30 min sem uso ou 8 h desde o login (RN-A3).",
    },
    servers: [{ url: "http://localhost:3001", description: "Desenvolvimento" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          // Deliberadamente NÃO é "JWT": declarar JWT aqui faria ferramentas
          // tentarem decodificar um token que é opaco.
          bearerFormat: "opaque",
        },
      },
      // Gerados dos mesmos schemas Zod que validam as requisições.
      schemas: { Error: errorSchema, ...generatedSchemas },
      responses: commonResponses,
    },
  },
  // Em dev lê os .ts; em produção, os .js compilados.
  apis: [path.join(__dirname, "../../modules/**/*Routes.{js,ts}")],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
