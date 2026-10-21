import { AppDataSource } from "@/shared/database/data-source";

// Tabelas limpas entre testes. O CASCADE cuida das filhas (telefones,
// idiomas, experiências, habilidades, certificações), então só as raízes
// precisam ser listadas.
const TABLES = [
  "single_use_tokens",
  "sessions",
  "admins",
  "formations",
  "responsibles",
  "advertisers",
  "students",
  "courses",
  "settings",
] as const;

// `vacancy_prices` não pode ser truncada: as três linhas vêm da migration
// (RF39) e, sem elas, nenhuma vaga teria valor. Em vez de apagar, restaura —
// senão um teste que muda o preço do estágio contamina os seguintes.
//
// Os valores espelham a carga da migration de propósito, e o teste de preços
// afirma que o GET devolve exatamente estes: se alguém mudar a carga e
// esquecer daqui, o teste quebra em vez de o leak passar em silêncio.
const INITIAL_VACANCY_PRICES: Record<string, number> = {
  estagio: 5,
  emprego: 10,
  jovem_aprendiz: 5,
};

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

  // INSERT, não UPDATE: `vacancy_prices.updated_by` referencia `admins`, e
  // o CASCADE do TRUNCATE alcança toda tabela que aponta para as listadas —
  // ou seja, as três linhas de preço são apagadas junto. O reset tem de
  // recriá-las, com autor nulo (o admin que as alterou também se foi).
  for (const [type, value] of Object.entries(INITIAL_VACANCY_PRICES)) {
    await AppDataSource.query(
      `INSERT INTO "vacancy_prices" ("type", "value") VALUES ($2, $1)
       ON CONFLICT ("type") DO UPDATE SET "value" = $1, "updated_by" = NULL`,
      [value, type],
    );
  }
}
