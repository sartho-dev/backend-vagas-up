import { MigrationInterface, QueryRunner } from "typeorm";

export class Payments1792606603699 implements MigrationInterface {
  name = "Payments1792606603699";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."payments_situation_enum" AS ENUM('confirmado', 'recusado', 'reembolsado')`,
    );

    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "vacancy_id" uuid NOT NULL, "value" numeric(10,2) NOT NULL, "reference_code" character varying(12) NOT NULL, "situation" "public"."payments_situation_enum" NOT NULL, "decided_by" uuid NOT NULL, "decided_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "note" text, CONSTRAINT "UQ_payments_vacancy_id" UNIQUE ("vacancy_id"), CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"))`,
    );

    // RF37: "ver pagamentos por período" filtra por data.
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_decided_at" ON "payments" ("decided_at")`,
    );

    // RESTRICT nas duas (RNF06): este é o registro contábil do dinheiro.
    // A vaga não é apagada depois de paga (a task 13 só deixa excluir vaga
    // nunca publicada) e o admin é desativado, não apagado (RF34).
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_vacancy" FOREIGN KEY ("vacancy_id") REFERENCES "vacancies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_decided_by" FOREIGN KEY ("decided_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // RF28 / RN-P3: a chave PIX que o anunciante vê na tela de pagamento.
    // Entra no enum fechado de `settings` (task 12): chave nova = uma linha
    // no enum e uma no validador. Sem valor configurado, a tela avisa em
    // vez de o envio da vaga falhar.
    //
    // O tipo é RECRIADO em vez de receber `ALTER TYPE ... ADD VALUE`: o
    // ADD VALUE não pode ser usado na mesma transação em que é criado, e as
    // migrations rodam com `transaction: "all"` (ver data-source.ts). O
    // caminho abaixo funciona dentro da transação e é simétrico ao down().
    await queryRunner.query(
      `ALTER TABLE "settings" ALTER COLUMN "key" TYPE text`,
    );
    await queryRunner.query(`DROP TYPE "public"."settings_key_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."settings_key_enum" AS ENUM('advertiser_community_url', 'sponsorship_contact', 'pix_key')`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ALTER COLUMN "key" TYPE "public"."settings_key_enum" USING "key"::"public"."settings_key_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_decided_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_vacancy"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_payments_decided_at"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_situation_enum"`);

    // A volta apaga a chave antes de estreitar o tipo: com uma linha
    // `pix_key` no lugar, o cast para o enum antigo falharia e a reversão
    // travaria no meio.
    await queryRunner.query(`DELETE FROM "settings" WHERE "key" = 'pix_key'`);
    await queryRunner.query(
      `ALTER TABLE "settings" ALTER COLUMN "key" TYPE text`,
    );
    await queryRunner.query(`DROP TYPE "public"."settings_key_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."settings_key_enum" AS ENUM('advertiser_community_url', 'sponsorship_contact')`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ALTER COLUMN "key" TYPE "public"."settings_key_enum" USING "key"::"public"."settings_key_enum"`,
    );
  }
}
