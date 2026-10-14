import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(__dirname, "../../.env.test"),
  override: true,
});

// Rede de segurança: nenhum worker pode acabar apontando para o banco de
// desenvolvimento. As migrations ficam no globalSetup, não aqui.
if (process.env.DB_DATABASE !== "estagia_mais_test") {
  throw new Error(
    `DB_DATABASE precisa ser 'estagia_mais_test' durante os testes. ` +
      `Recebido: '${process.env.DB_DATABASE}'.`,
  );
}
