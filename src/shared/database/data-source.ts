import "reflect-metadata";
import { DataSource } from "typeorm";
import path from "path";
import { config } from "../config";

import { Admin } from "../../modules/admin/schema/Admin.schema";
import { Course } from "../../modules/course/schema/Course.schema";
import { Formation } from "../../modules/formation/schema/Formation.schema";
import { Advertiser } from "../../modules/advertiser/schema/Advertiser.schema";
import { Responsible } from "../../modules/advertiser/schema/Responsible.schema";
import { Session } from "../../modules/auth/schema/Session.schema";
import { SingleUseToken } from "../../modules/auth/schema/SingleUseToken.schema";
import { Student } from "../../modules/student/schema/Student.schema";
import { StudentCertification } from "../../modules/student/schema/StudentCertification.schema";
import { StudentExperience } from "../../modules/student/schema/StudentExperience.schema";
import { StudentLanguage } from "../../modules/student/schema/StudentLanguage.schema";
import { StudentPhone } from "../../modules/student/schema/StudentPhone.schema";
import { StudentSkill } from "../../modules/student/schema/StudentSkill.schema";
import { VacancyPrice } from "../../modules/pricing/schema/VacancyPrice.schema";
import { Setting } from "../../modules/pricing/schema/Setting.schema";
import { Payment } from "../../modules/payment/schema/Payment.schema";
import { Vacancy } from "../../modules/vacancy/schema/Vacancy.schema";

import { Init1790906306331 } from "./migrations/1790906306331-Init";
import { Init1790966781806 } from "./migrations/1790966781806-Init";
import { Init1790969876891 } from "./migrations/1790969876891-Init";
import { Init1791845311089 } from "./migrations/1791845311089-Init";
import { LoginAttempts1792085200837 } from "./migrations/1792085200837-LoginAttempts";
import { CandidateProfileV491792257488337 } from "./migrations/1792257488337-CandidateProfileV49";
import { SingleUseTokens1792270518043 } from "./migrations/1792270518043-SingleUseTokens";
import { Courses1792413012797 } from "./migrations/1792413012797-Courses";
import { Formations1792413953262 } from "./migrations/1792413953262-Formations";
import { Advertisers1792415961678 } from "./migrations/1792415961678-Advertisers";
import { AdvertiserVerification1792536962495 } from "./migrations/1792536962495-AdvertiserVerification";
import { VacancyPricesAndSettings1792548594503 } from "./migrations/1792548594503-VacancyPricesAndSettings";
import { Vacancies1792590388776 } from "./migrations/1792590388776-Vacancies";
import { Payments1792606603699 } from "./migrations/1792606603699-Payments";

// Define a pasta base dependendo do ambiente
const baseDir = path.join(__dirname, "../../");

export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,
  synchronize: false,
  logging: false,
  // Usa o path.join para garantir que ele ache os arquivos, não importa a subpasta
  entities: [
    Admin,
    Course,
    Formation,
    Advertiser,
    Payment,
    Responsible,
    Session,
    Setting,
    SingleUseToken,
    Student,
    StudentCertification,
    StudentExperience,
    StudentLanguage,
    StudentPhone,
    StudentSkill,
    Vacancy,
    VacancyPrice,
  ],
  // Importadas estaticamente, nao por glob: sob o Vitest o TypeORM faria
  // require() nos .ts e o Node nao os parseia. A ordem e por timestamp.
  // Os testes criam o schema rodando estas migrations (test/setup/global-setup.ts).
  migrations: [
    Init1790906306331,
    Init1790966781806,
    Init1790969876891,
    Init1791845311089,
    LoginAttempts1792085200837,
    CandidateProfileV491792257488337,
    SingleUseTokens1792270518043,
    Courses1792413012797,
    Formations1792413953262,
    Advertisers1792415961678,
    AdvertiserVerification1792536962495,
    VacancyPricesAndSettings1792548594503,
    Vacancies1792590388776,
    Payments1792606603699,
  ],

  // Isso força o SSL necessário para o Google Cloud SQL
  ssl: false,
});
