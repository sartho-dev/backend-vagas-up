import { MigrationInterface, QueryRunner } from "typeorm";

export class PublicVacancySearch1793222775430 implements MigrationInterface {
  name = "PublicVacancySearch1793222775430";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // RF42: endereço próprio e legível por vaga. Nulo enquanto a vaga não é
    // pública — rascunho e vaga aguardando pagamento não têm endereço, e
    // gerar um antes faria o link existir sem página para abrir.
    await queryRunner.query(
      `ALTER TABLE "vacancies" ADD "slug" character varying(180)`,
    );
    await queryRunner.query(
      `ALTER TABLE "vacancies" ADD CONSTRAINT "UQ_vacancies_slug" UNIQUE ("slug")`,
    );

    // RF14 + RNF04: a busca por palavra-chave.
    //
    // Coluna GERADA, não preenchida pela aplicação: assim ela não pode sair
    // de sincronia com o texto da vaga. É `STORED` porque GIN exige valor
    // materializado.
    //
    // Pesos: título vale mais que cidade, que vale mais que descrição (A/B/C
    // do `ts_rank`). Quem procura "vendedor" quer a vaga cujo TÍTULO é
    // vendedor, não a que menciona vendedor no meio do texto.
    //
    // `coalesce` em tudo: a configuração 'portuguese' é imutável, mas
    // `to_tsvector` de NULL devolve NULL e contaminaria o vetor inteiro.
    await queryRunner.query(
      `ALTER TABLE "vacancies" ADD "search_vector" tsvector GENERATED ALWAYS AS (
         setweight(to_tsvector('portuguese', coalesce("title", '')), 'A') ||
         setweight(to_tsvector('portuguese', coalesce("city", '')), 'B') ||
         setweight(to_tsvector('portuguese', coalesce("description", '')), 'C')
       ) STORED`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vacancies_search_vector" ON "vacancies" USING GIN ("search_vector")`,
    );

    // RNF04: índices nos campos filtrados. Os três índices abaixo são
    // PARCIAIS (`WHERE situation = 'aberta'`) porque a busca pública nunca
    // olha outra situação — índice parcial é menor, cabe em memória e não
    // cresce com rascunho nem com vaga encerrada, que são a maioria das
    // linhas com o tempo.
    //
    // O primeiro serve à ordenação ("mais recentes primeiro") e ao corte por
    // validade, que toda busca aplica.
    await queryRunner.query(
      `CREATE INDEX "IDX_vacancies_open_published" ON "vacancies" ("published_at" DESC, "expires_at") WHERE "situation" = 'aberta'`,
    );
    // Cidade e tipo são os filtros que o candidato combina mais.
    //
    // O índice é sobre `lower("city")`, não sobre `city`: a cidade é texto
    // livre digitado pelo anunciante, então "Campo Grande" e "campo grande"
    // são a mesma cidade e a busca compara em minúsculas. Um índice sobre a
    // coluna crua não serviria àquela comparação e o Postgres varreria a
    // tabela.
    await queryRunner.query(
      `CREATE INDEX "IDX_vacancies_open_city_type" ON "vacancies" (lower("city"), "type") WHERE "situation" = 'aberta'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vacancies_open_course" ON "vacancies" ("course_id") WHERE "situation" = 'aberta'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_vacancies_open_course"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_vacancies_open_city_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_vacancies_open_published"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_vacancies_search_vector"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vacancies" DROP COLUMN "search_vector"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vacancies" DROP CONSTRAINT "UQ_vacancies_slug"`,
    );
    await queryRunner.query(`ALTER TABLE "vacancies" DROP COLUMN "slug"`);
  }
}
