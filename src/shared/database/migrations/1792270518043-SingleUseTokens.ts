import { MigrationInterface, QueryRunner } from "typeorm";

export class SingleUseTokens1792270518043 implements MigrationInterface {
    name = 'SingleUseTokens1792270518043'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."single_use_tokens_type_enum" AS ENUM('recuperacao', 'convite', 'troca_email')`);
        await queryRunner.query(`CREATE TYPE "public"."single_use_tokens_account_type_enum" AS ENUM('student', 'responsible', 'admin')`);
        await queryRunner.query(`CREATE TABLE "single_use_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."single_use_tokens_type_enum" NOT NULL, "target_email" character varying(255) NOT NULL, "account_type" "public"."single_use_tokens_account_type_enum", "account_id" uuid, "token_hash" character(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_bc97f117b6649e0d920efb67c8f" UNIQUE ("token_hash"), CONSTRAINT "PK_5a18121106d3ab85dc481dd058b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_91b60727e7571ea3cc785533d2" ON "single_use_tokens"  ("type", "target_email") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_91b60727e7571ea3cc785533d2"`);
        await queryRunner.query(`DROP TABLE "single_use_tokens"`);
        await queryRunner.query(`DROP TYPE "public"."single_use_tokens_account_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."single_use_tokens_type_enum"`);
    }

}
