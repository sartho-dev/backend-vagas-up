import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1791845311089 implements MigrationInterface {
    name = 'Init1791845311089'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "admins" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, CONSTRAINT "UQ_051db7d37d478a69a7432df1479" UNIQUE ("email"), CONSTRAINT "PK_e3b38270c97a854c48d2e80874e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "expected_graduation"`);
        await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "current_semester"`);
        await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "institution"`);
        await queryRunner.query(`ALTER TABLE "admins" ADD CONSTRAINT "FK_df8988d920f8bd154c37cf81004" FOREIGN KEY ("created_by") REFERENCES "admins"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admins" DROP CONSTRAINT "FK_df8988d920f8bd154c37cf81004"`);
        await queryRunner.query(`ALTER TABLE "students" ADD "institution" character varying(150)`);
        await queryRunner.query(`ALTER TABLE "students" ADD "current_semester" smallint`);
        await queryRunner.query(`ALTER TABLE "students" ADD "expected_graduation" character(7)`);
        await queryRunner.query(`DROP TABLE "admins"`);
    }

}
