import { MigrationInterface, QueryRunner } from "typeorm";

export class LoginAttempts1792085200837 implements MigrationInterface {
    name = 'LoginAttempts1792085200837'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admins" ADD "failed_logins" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "admins" ADD "blocked_until" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "students" ADD "failed_logins" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "students" ADD "blocked_until" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "blocked_until"`);
        await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "failed_logins"`);
        await queryRunner.query(`ALTER TABLE "admins" DROP COLUMN "blocked_until"`);
        await queryRunner.query(`ALTER TABLE "admins" DROP COLUMN "failed_logins"`);
    }

}
