import { MigrationInterface, QueryRunner } from "typeorm";

export class Advertisers1792415961678 implements MigrationInterface {
    name = 'Advertisers1792415961678'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."advertisers_type_enum" AS ENUM('PJ', 'PF')`);
        await queryRunner.query(`CREATE TYPE "public"."advertisers_verification_enum" AS ENUM('pendente', 'verificado', 'recusado')`);
        await queryRunner.query(`CREATE TABLE "advertisers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."advertisers_type_enum" NOT NULL, "document" character varying(14) NOT NULL, "display_name" character varying(150) NOT NULL, "legal_name" character varying(150), "contact_email" character varying(255) NOT NULL, "contact_phone" character varying(20) NOT NULL, "site" character varying(255), "verification" "public"."advertisers_verification_enum" NOT NULL DEFAULT 'pendente', "verification_requested_at" TIMESTAMP WITH TIME ZONE, "verified_by" uuid, "verified_at" TIMESTAMP WITH TIME ZONE, "verification_method" character varying(150), "rejection_reason" text, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f2e377b161600279675c563a3f1" UNIQUE ("document"), CONSTRAINT "PK_a0618516584bd6609576d6a9ff5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "responsibles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "advertiser_id" uuid NOT NULL, "name" character varying(150) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "active" boolean NOT NULL DEFAULT true, "failed_logins" integer NOT NULL DEFAULT '0', "blocked_until" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_c3086650c39c8b98146aeb37e1f" UNIQUE ("email"), CONSTRAINT "PK_3bfd9b63cf33352711d7c82bab3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3d5e120de6cb15bcc8b2d589c7" ON "responsibles"  ("advertiser_id") `);
        await queryRunner.query(`ALTER TABLE "single_use_tokens" ADD "advertiser_id" uuid`);
        await queryRunner.query(`ALTER TABLE "responsibles" ADD CONSTRAINT "FK_3d5e120de6cb15bcc8b2d589c77" FOREIGN KEY ("advertiser_id") REFERENCES "advertisers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "single_use_tokens" ADD CONSTRAINT "FK_99add315745464d178d76894446" FOREIGN KEY ("advertiser_id") REFERENCES "advertisers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "single_use_tokens" DROP CONSTRAINT "FK_99add315745464d178d76894446"`);
        await queryRunner.query(`ALTER TABLE "responsibles" DROP CONSTRAINT "FK_3d5e120de6cb15bcc8b2d589c77"`);
        await queryRunner.query(`ALTER TABLE "single_use_tokens" DROP COLUMN "advertiser_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3d5e120de6cb15bcc8b2d589c7"`);
        await queryRunner.query(`DROP TABLE "responsibles"`);
        await queryRunner.query(`DROP TABLE "advertisers"`);
        await queryRunner.query(`DROP TYPE "public"."advertisers_verification_enum"`);
        await queryRunner.query(`DROP TYPE "public"."advertisers_type_enum"`);
    }

}
