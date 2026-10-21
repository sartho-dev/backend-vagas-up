import { MigrationInterface, QueryRunner } from "typeorm";

export class Vacancies1792590388776 implements MigrationInterface {
  name = "Vacancies1792590388776";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enums próprios da tabela, e não reaproveitados de `vacancy_prices`:
    // dois donos no mesmo tipo do Postgres travariam a evolução dos dois.
    // Só `vacancies_type_enum` repete os valores do tipo de vaga, de
    // propósito — é a mesma lista do VacancyType, que o Zod também valida.
    await queryRunner.query(
      `CREATE TYPE "public"."vacancies_type_enum" AS ENUM('estagio', 'emprego', 'jovem_aprendiz')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."vacancies_modality_enum" AS ENUM('presencial', 'remoto', 'hibrido')`,
    );
    // RN-VG1. 'suspensa' nasce aqui mesmo sem rota que leve a vaga até lá
    // (é a denúncia procedente da task 20): acrescentar valor a um enum do
    // Postgres depois custaria uma migration só para isso.
    await queryRunner.query(
      `CREATE TYPE "public"."vacancies_situation_enum" AS ENUM('rascunho', 'aguardando_pagamento', 'aberta', 'suspensa', 'encerrada')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."vacancies_min_education_enum" AS ENUM('fundamental_incompleto', 'fundamental_completo', 'medio_em_andamento', 'medio_completo', 'tecnico_em_andamento', 'tecnico_completo', 'superior_em_andamento', 'superior_completo', 'pos_graduacao')`,
    );

    await queryRunner.query(
      `CREATE TABLE "vacancies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "advertiser_id" uuid NOT NULL, "created_by" uuid NOT NULL, "type" "public"."vacancies_type_enum" NOT NULL, "requires_adult" boolean NOT NULL DEFAULT false, "title" character varying(150) NOT NULL, "description" text NOT NULL, "modality" "public"."vacancies_modality_enum" NOT NULL, "city" character varying(100) NOT NULL, "work_hours" numeric(4,1) NOT NULL, "min_education" "public"."vacancies_min_education_enum" NOT NULL, "course_id" uuid, "requirements" text, "benefits" text, "compensation" character varying(100), "schedule" character varying(100), "deadline" TIMESTAMP WITH TIME ZONE, "positions" integer NOT NULL DEFAULT 1, "situation" "public"."vacancies_situation_enum" NOT NULL DEFAULT 'rascunho', "free" boolean NOT NULL DEFAULT false, "value" numeric(10,2), "reference_code" character varying(12) NOT NULL, "published_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, "closed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_vacancies_reference_code" UNIQUE ("reference_code"), CONSTRAINT "PK_vacancies_id" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_vacancies_advertiser_id" ON "vacancies" ("advertiser_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vacancies_situation" ON "vacancies" ("situation")`,
    );

    // RESTRICT em todas: RNF06. Anunciante e responsável são desativados,
    // não apagados, e a task 08 já impede excluir curso em uso.
    await queryRunner.query(
      `ALTER TABLE "vacancies" ADD CONSTRAINT "FK_vacancies_advertiser" FOREIGN KEY ("advertiser_id") REFERENCES "advertisers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vacancies" ADD CONSTRAINT "FK_vacancies_created_by" FOREIGN KEY ("created_by") REFERENCES "responsibles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vacancies" ADD CONSTRAINT "FK_vacancies_course" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vacancies" DROP CONSTRAINT "FK_vacancies_course"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vacancies" DROP CONSTRAINT "FK_vacancies_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vacancies" DROP CONSTRAINT "FK_vacancies_advertiser"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_vacancies_situation"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_vacancies_advertiser_id"`,
    );
    await queryRunner.query(`DROP TABLE "vacancies"`);
    await queryRunner.query(
      `DROP TYPE "public"."vacancies_min_education_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."vacancies_situation_enum"`);
    await queryRunner.query(`DROP TYPE "public"."vacancies_modality_enum"`);
    await queryRunner.query(`DROP TYPE "public"."vacancies_type_enum"`);
  }
}
