import { AppDataSource } from "@/shared/database/data-source";

export async function truncateAll(): Promise<void> {
  // Apenas trunca se o banco está inicializado
  if (!AppDataSource.isInitialized) {
    return;
  }

  try {
    await AppDataSource.query(`TRUNCATE TABLE
      "sessions", "admins", "students"
      RESTART IDENTITY CASCADE`);
  } catch (error) {
    // Se as tabelas não existem (ex: testes skipados), ignora
    console.warn("Truncate failed (tables may not exist):", (error as Error).message);
  }
}
