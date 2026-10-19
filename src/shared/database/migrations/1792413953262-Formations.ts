import { MigrationInterface, QueryRunner } from "typeorm";

export class Formations1792413953262 implements MigrationInterface {
    name = 'Formations1792413953262'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."formations_level_enum" AS ENUM('fundamental_incompleto', 'fundamental_completo', 'medio_em_andamento', 'medio_completo', 'tecnico_em_andamento', 'tecnico_completo', 'superior_em_andamento', 'superior_completo', 'pos_graduacao')`);
        await queryRunner.query(`CREATE TYPE "public"."formations_status_enum" AS ENUM('em_andamento', 'concluida', 'trancada')`);
        await queryRunner.query(`CREATE TABLE "formations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "level" "public"."formations_level_enum" NOT NULL, "course_id" uuid, "institution" character varying(150) NOT NULL, "status" "public"."formations_status_enum" NOT NULL, "start_date" date NOT NULL, "end_date" date, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e071aaba3322392364953ba5c95" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5bee7b6e4508f155b5e998b050" ON "formations"  ("student_id") `);
        await queryRunner.query(`ALTER TABLE "formations" ADD CONSTRAINT "FK_5bee7b6e4508f155b5e998b050d" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "formations" ADD CONSTRAINT "FK_4f4909e0842648a4a6705782801" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "formations" DROP CONSTRAINT "FK_4f4909e0842648a4a6705782801"`);
        await queryRunner.query(`ALTER TABLE "formations" DROP CONSTRAINT "FK_5bee7b6e4508f155b5e998b050d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5bee7b6e4508f155b5e998b050"`);
        await queryRunner.query(`DROP TABLE "formations"`);
        await queryRunner.query(`DROP TYPE "public"."formations_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."formations_level_enum"`);
    }

}
