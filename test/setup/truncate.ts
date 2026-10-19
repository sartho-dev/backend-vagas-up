import { AppDataSource } from "@/shared/database/data-source";

// Tabelas limpas entre testes. O CASCADE cuida das filhas (telefones,
// idiomas, experiências, habilidades, certificações), então só as raízes
// precisam ser listadas.
const TABLES = [
  "single_use_tokens",
  "sessions",
  "admins",
  "formations",
  "students",
  "courses",
] as const;

export async function truncateAll(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    return;
  }

  // Sem try/catch de propósito: um TRUNCATE que falha deixa dados de um
  // teste visíveis no seguinte, e engolir o erro transforma isso em falhas
  // intermitentes e inexplicáveis. É melhor quebrar alto.
  await AppDataSource.query(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
}
