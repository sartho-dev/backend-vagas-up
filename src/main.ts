import { config } from "./shared/config";
process.env.TZ = config.timezone;

import { App } from "./App";
import { buildContainer } from "./shared/container";
import { AppDataSource } from "./shared/database/data-source";

async function bootstrap() {
  //banco inicializado
  await AppDataSource.initialize();

  //objetos são contruidos
  const container = buildContainer();

  //App recebe o container com os objetos
  const app = new App(container);
  await app.listen();
}

bootstrap().catch((err) => {
  console.error("---Falha no boot---:", err);
  process.exit(1);
});
