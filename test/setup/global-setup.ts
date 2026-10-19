import { AppDataSource } from "@/shared/database/data-source";
import { ensureMigrations } from "./migrate";

// Roda UMA vez, no processo principal, antes de qualquer worker subir.
// As migrations têm que ficar aqui: em setupFiles elas rodariam uma vez por
// arquivo de teste, em paralelo, e duas migrations simultâneas colidem ao
// criar a tabela "migrations" (duplicate key em pg_class_relname_nsp_index).
export async function setup(): Promise<void> {
  if (process.env.DB_DATABASE !== "estagia_mais_test") {
    throw new Error(
      `DB_DATABASE precisa ser 'estagia_mais_test' durante os testes. ` +
        `Recebido: '${process.env.DB_DATABASE}'.`,
    );
  }

  await ensureMigrations();

  // Libera o pool: os workers abrem as próprias conexões.
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

export async function teardown(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}
