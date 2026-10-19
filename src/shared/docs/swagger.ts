import swaggerJsdoc from "swagger-jsdoc";
import path from "path";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Estagia CG API",
      version: "1.0.0",
      description: "API do Estagia CG",
    },
    servers: [{ url: "http://localhost:3001", description: "Desenvolvimento" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "opaque",
        },
      },
    },
  },
  // Em dev: src/modules/**/*Routes.ts | Em prod: dist/modules/**/*Routes.ts
  apis: [path.join(__dirname, "../../modules/**/*Routes.{js,ts}")],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
