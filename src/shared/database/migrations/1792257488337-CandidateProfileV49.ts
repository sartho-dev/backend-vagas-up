import { MigrationInterface, QueryRunner } from "typeorm";

export class CandidateProfileV491792257488337 implements MigrationInterface {
    name = 'CandidateProfileV491792257488337'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student_phones" ADD "is_whatsapp" boolean NOT NULL DEFAULT false`);
        // Backfill: a coluna é obrigatória e a tabela já tem linhas, então
        // entra com DEFAULT e o DEFAULT sai em seguida. Sem isso o ALTER
        // falha em qualquer banco não vazio. "Campo Grande" é o atendimento
        // inicial do produto (SRS 1.2); só afeta cadastros anteriores a esta
        // migration — daqui em diante a cidade é obrigatória no cadastro.
        await queryRunner.query(`ALTER TABLE "students" ADD "city" character varying(120) NOT NULL DEFAULT 'Campo Grande'`);
        await queryRunner.query(`ALTER TABLE "students" ALTER COLUMN "city" DROP DEFAULT`);
        await queryRunner.query(`CREATE TYPE "public"."students_education_level_enum" AS ENUM('fundamental_incompleto', 'fundamental_completo', 'medio_em_andamento', 'medio_completo', 'tecnico_em_andamento', 'tecnico_completo', 'superior_em_andamento', 'superior_completo', 'pos_graduacao')`);
        // Mesmo caso. Não existe escolaridade "correta" para quem se
        // cadastrou antes de o campo existir: 'medio_completo' é só um valor
        // de preenchimento para as linhas pré-existentes (dados de teste
        // anteriores ao lançamento). O DEFAULT sai logo depois, então todo
        // cadastro novo é obrigado a informar.
        await queryRunner.query(`ALTER TABLE "students" ADD "education_level" "public"."students_education_level_enum" NOT NULL DEFAULT 'medio_completo'`);
        await queryRunner.query(`ALTER TABLE "students" ALTER COLUMN "education_level" DROP DEFAULT`);
        await queryRunner.query(`CREATE TYPE "public"."students_visibility_enum" AS ENUM('oculto', 'so_verificados', 'publico')`);
        await queryRunner.query(`ALTER TABLE "students" ADD "visibility" "public"."students_visibility_enum" NOT NULL DEFAULT 'oculto'`);
        await queryRunner.query(`ALTER TABLE "students" ADD "photo_url" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "students" ADD "resume_url" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "resume_url"`);
        await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "photo_url"`);
        await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "visibility"`);
        await queryRunner.query(`DROP TYPE "public"."students_visibility_enum"`);
        await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "education_level"`);
        await queryRunner.query(`DROP TYPE "public"."students_education_level_enum"`);
        await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "city"`);
        await queryRunner.query(`ALTER TABLE "student_phones" DROP COLUMN "is_whatsapp"`);
    }

}
