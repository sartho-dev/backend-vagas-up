import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1792536962495 implements MigrationInterface {
    name = 'Init1792536962495'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "advertisers" DROP COLUMN "verification_method"`);
        await queryRunner.query(`CREATE TYPE "public"."advertisers_verification_method_enum" AS ENUM('cnpj_lookup_email_domain', 'cnpj_lookup_phone_call', 'video_call')`);
        await queryRunner.query(`ALTER TABLE "advertisers" ADD "verification_method" "public"."advertisers_verification_method_enum"`);
        await queryRunner.query(`ALTER TABLE "advertisers" ADD CONSTRAINT "FK_18f252c4b82f8bed7b602991e8f" FOREIGN KEY ("verified_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "advertisers" DROP CONSTRAINT "FK_18f252c4b82f8bed7b602991e8f"`);
        await queryRunner.query(`ALTER TABLE "advertisers" DROP COLUMN "verification_method"`);
        await queryRunner.query(`DROP TYPE "public"."advertisers_verification_method_enum"`);
        await queryRunner.query(`ALTER TABLE "advertisers" ADD "verification_method" character varying(150)`);
    }

}
