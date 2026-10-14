import { AppDataSource } from "@/shared/database/data-source";

// Roda uma vez por worker, antes do primeiro teste do processo.
// Idempotente: se as tabelas já existem, runMigrations é no-op.
export async function ensureMigrations(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  await AppDataSource.runMigrations({ transaction: "all" });
}
