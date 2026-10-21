import { MigrationInterface, QueryRunner } from "typeorm";

export class VacancyPricesAndSettings1792548594503 implements MigrationInterface {
  name = "VacancyPricesAndSettings1792548594503";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."vacancy_prices_type_enum" AS ENUM('estagio', 'emprego', 'jovem_aprendiz')`,
    );
    await queryRunner.query(
      `CREATE TABLE "vacancy_prices" ("type" "public"."vacancy_prices_type_enum" NOT NULL, "value" numeric(10,2) NOT NULL, "updated_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2b2eb42552cd13684deaa5f2b1b" PRIMARY KEY ("type"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."settings_key_enum" AS ENUM('advertiser_community_url', 'sponsorship_contact')`,
    );
    await queryRunner.query(
      `CREATE TABLE "settings" ("key" "public"."settings_key_enum" NOT NULL, "value" text NOT NULL, "updated_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c8639b7626fa94ba8265628f214" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "vacancy_prices" ADD CONSTRAINT "FK_d1a85e52165ff7d2105a63a4cae" FOREIGN KEY ("updated_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD CONSTRAINT "FK_2e89ab90a38669764401e356223" FOREIGN KEY ("updated_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // RF39: as três linhas nascem aqui, não por rota. Existe uma por
    // tipo de vaga e a PK é o tipo, então não há "cadastrar preço": sem
    // esta carga, a primeira vaga enviada não teria valor nenhum.
    //
    // Preços iniciais decididos em 20/10/2026 — estágio R$ 5, emprego
    // R$ 10 e jovem aprendiz R$ 5. Isso **resolve a pendência P7** e
    // substitui os R$ 20 / R$ 35 da RN-P1, que vinham da v4.4. O
    // administrador muda qualquer um deles pela RF39, sem deploy.
    //
    // `updated_by` fica nulo: a carga não tem autor.
    await queryRunner.query(
      `INSERT INTO "vacancy_prices" ("type", "value") VALUES ('estagio', 5.00), ('emprego', 10.00), ('jovem_aprendiz', 5.00)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP CONSTRAINT "FK_2e89ab90a38669764401e356223"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vacancy_prices" DROP CONSTRAINT "FK_d1a85e52165ff7d2105a63a4cae"`,
    );
    await queryRunner.query(`DROP TABLE "settings"`);
    await queryRunner.query(`DROP TYPE "public"."settings_key_enum"`);
    await queryRunner.query(`DROP TABLE "vacancy_prices"`);
    await queryRunner.query(`DROP TYPE "public"."vacancy_prices_type_enum"`);
  }
}
