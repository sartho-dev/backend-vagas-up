import express, { Application } from "express";
import { Server } from "http";
import helmet from "helmet";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
  import { config } from "./shared/config";
import routesMain from "./routes";
import { errorHandler } from "./shared/middleware/errorHandler";
import swaggerSpec from "./shared/docs/swagger";
import { Container } from "./shared/container";

export class App {
  private _app: Application;
  private server: Server | null = null;

  constructor(private container: Container) {
    this._app = express();
    this.config();
    this.routes();
  }

  private config() {
    this._app.use(helmet());

    const corsOptions = {
      origin: [
        "http://localhost:5173", // URL padrão do Vite/React
        // Adicione as URLs do seu frontend de vagas aqui futuramente
      ],
      methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
      credentials: true,
      optionsSuccessStatus: 200,
      exposedHeaders: ["Content-Disposition"],
    };
    this._app.use(cors(corsOptions));

    this._app.use(express.json());

    // Configuração de Trust Proxy mantida (ótima prática para rodar atrás de Docker/Nginx/Cloud)
    this._app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 1));

    this._app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }

  private routes() {
    this._app.use(routesMain(this.container));
    this._app.use(errorHandler);
  }

  public async listen(): Promise<void> {
    this.server = this._app.listen(config.port, "0.0.0.0", () => {
      console.log(`🚀 Servidor rodando em http://0.0.0.0:${config.port}`);
      console.log(
        `📚 Documentação disponível em: http://localhost:${config.port}/api-docs`,
      );
    });
  }

  public get app() {
    return this._app;
  }
}
