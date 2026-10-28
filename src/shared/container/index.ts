import { StudentController } from "../../modules/student/controller/StudentController";
import { StudentRepository } from "../../modules/student/repository/StudentRepository";
import { StudentService } from "../../modules/student/service/StudentService";
import { AppDataSource } from "../database/data-source";
import { Student } from "../../modules/student/schema/Student.schema";
import { Admin } from "../../modules/admin/schema/Admin.schema";
import { AdminRepository } from "../../modules/admin/repository/AdminRepository";
import { AdminService } from "../../modules/admin/service/AdminService";
import { AdminController } from "../../modules/admin/controller/AdminController";
import { AuthService } from "../../modules/auth/service/AuthService";
import { StudentAuthProvider } from "../../modules/auth/providers/StudentAuthProvider";
import { AdminAuthProvider } from "../../modules/admin/providers/AdminAuthProvider";
import { SessionRepository } from "../../modules/auth/repository/SessionRepository";
import { Session } from "../../modules/auth/schema/Session.schema";
import { AuthController } from "../../modules/auth/controller/AuthController";
import { makeAuthenticate } from "../../modules/auth/middleware/authenticate";
import { AccountRole } from "../../modules/auth/types/AccountRole";
import { SingleUseToken } from "../../modules/auth/schema/SingleUseToken.schema";
import { SingleUseTokenRepository } from "../../modules/auth/repository/SingleUseTokenRepository";
import { SingleUseTokenService } from "../../modules/auth/service/SingleUseTokenService";
import { AccountRecoveryService } from "../../modules/auth/service/AccountRecoveryService";
import { RecoveryController } from "../../modules/auth/controller/RecoveryController";
import {
  ConsoleEmailSender,
  IEmailSender,
  SmtpEmailSender,
} from "../services/EmailSender";
import { config } from "../config";
import { Course } from "../../modules/course/schema/Course.schema";
import { CourseRepository } from "../../modules/course/repository/CourseRepository";
import { CourseService } from "../../modules/course/service/CourseService";
import { CourseController } from "../../modules/course/controller/CourseController";
import { Formation } from "../../modules/formation/schema/Formation.schema";
import { FormationRepository } from "../../modules/formation/repository/FormationRepository";
import { FormationService } from "../../modules/formation/service/FormationService";
import { FormationController } from "../../modules/formation/controller/FormationController";
import { Advertiser } from "../../modules/advertiser/schema/Advertiser.schema";
import { Responsible } from "../../modules/advertiser/schema/Responsible.schema";
import { AdvertiserRepository } from "../../modules/advertiser/repository/AdvertiserRepository";
import { ResponsibleRepository } from "../../modules/advertiser/repository/ResponsibleRepository";
import { ResponsibleAuthProvider } from "../../modules/advertiser/providers/ResponsibleAuthProvider";
import { AdvertiserService } from "../../modules/advertiser/service/AdvertiserService";
import { AdvertiserController } from "../../modules/advertiser/controller/AdvertiserController";
import { AdvertiserVerificationService } from "../../modules/advertiser/service/AdvertiserVerificationService";
import { AdvertiserVerificationController } from "../../modules/advertiser/controller/AdvertiserVerificationController";
import { VacancyPrice } from "../../modules/pricing/schema/VacancyPrice.schema";
import { Setting } from "../../modules/pricing/schema/Setting.schema";
import { VacancyPriceRepository } from "../../modules/pricing/repository/VacancyPriceRepository";
import { SettingRepository } from "../../modules/pricing/repository/SettingRepository";
import { VacancyPriceService } from "../../modules/pricing/service/VacancyPriceService";
import { SettingService } from "../../modules/pricing/service/SettingService";
import { PricingController } from "../../modules/pricing/controller/PricingController";
import { Payment } from "../../modules/payment/schema/Payment.schema";
import { PaymentRepository } from "../../modules/payment/repository/PaymentRepository";
import { PaymentService } from "../../modules/payment/service/PaymentService";
import { PaymentController } from "../../modules/payment/controller/PaymentController";
import { Vacancy } from "../../modules/vacancy/schema/Vacancy.schema";
import { VacancyRepository } from "../../modules/vacancy/repository/VacancyRepository";
import { VacancyService } from "../../modules/vacancy/service/VacancyService";
import { VacancyController } from "../../modules/vacancy/controller/VacancyController";
import { PublicVacancyService } from "../../modules/vacancy/service/PublicVacancyService";
import { PublicVacancyController } from "../../modules/vacancy/controller/PublicVacancyController";
import { EmailRegistry, IEmailLookup } from "../services/EmailRegistry";
import { HttpCnpjLookup } from "../services/HttpCnpjLookup";
import {
  BcryptPasswordHasher,
  IPasswordHasher,
} from "../services/PasswordHasher";
import { ICnpjLookup, UnavailableCnpjLookup } from "../services/CnpjLookup";

export type ContainerOptions = {
  passwordHasher?: IPasswordHasher;
  // Os testes injetam o TestEmailSender; sem SMTP configurado, cai no
  // ConsoleEmailSender para a aplicação subir numa máquina nova.
  emailSender?: IEmailSender;
  // Os testes injetam um fake aqui — bater na Receita a cada teste é lento
  // e não determinístico.
  cnpjLookup?: ICnpjLookup;
};

export type Container = ReturnType<typeof buildContainer>;

export function buildContainer(options: ContainerOptions = {}) {
  const hasher = options.passwordHasher ?? new BcryptPasswordHasher();

  const emailSender =
    options.emailSender ??
    (config.mail.host && config.mail.user
      ? new SmtpEmailSender()
      : new ConsoleEmailSender());

  const cnpjLookup =
    options.cnpjLookup ??
    (config.cnpjLookup.baseUrl
      ? new HttpCnpjLookup(
          config.cnpjLookup.baseUrl,
          config.cnpjLookup.timeoutMs,
        )
      : new UnavailableCnpjLookup());

  const singleUseTokens = new SingleUseTokenService(
    new SingleUseTokenRepository(AppDataSource.getRepository(SingleUseToken)),
  );

  const studentRepository = new StudentRepository(
    AppDataSource.getRepository(Student),
  );
  const adminRepository = new AdminRepository(
    AppDataSource.getRepository(Admin),
  );
  const advertiserRepository = new AdvertiserRepository(
    AppDataSource.getRepository(Advertiser),
  );
  const responsibleRepository = new ResponsibleRepository(
    AppDataSource.getRepository(Responsible),
  );

  // RN06: one email, one account, across every kind of account.
  const emailRegistry = new EmailRegistry(
    new Map<AccountRole, IEmailLookup>([
      [AccountRole.STUDENT, studentRepository],
      [AccountRole.ADMIN, adminRepository],
      [AccountRole.RESPONSIBLE, responsibleRepository],
    ]),
  );

  const authService = new AuthService(
    [
      new StudentAuthProvider(studentRepository),
      new AdminAuthProvider(adminRepository),
      new ResponsibleAuthProvider(responsibleRepository),
    ],
    new SessionRepository(AppDataSource.getRepository(Session)),
    hasher,
  );
  const recoveryService = new AccountRecoveryService(
    [
      new StudentAuthProvider(studentRepository),
      new AdminAuthProvider(adminRepository),
      new ResponsibleAuthProvider(responsibleRepository),
    ],
    singleUseTokens,
    emailRegistry,
    emailSender,
    hasher,
    authService,
  );
  const recoveryController = new RecoveryController(recoveryService);

  const courseController = new CourseController(
    new CourseService(
      new CourseRepository(AppDataSource.getRepository(Course)),
    ),
  );

  const formationController = new FormationController(
    new FormationService(
      new FormationRepository(AppDataSource.getRepository(Formation)),
    ),
  );

  // Task 11: verificação compartilhada pelos dois atores. O service é o
  // mesmo; quem separa responsável de admin são os controllers e as rotas.
  const advertiserVerificationService = new AdvertiserVerificationService(
    advertiserRepository,
    responsibleRepository,
    cnpjLookup,
  );

  const advertiserController = new AdvertiserController(
    new AdvertiserService(
      advertiserRepository,
      emailRegistry,
      hasher,
      singleUseTokens,
      emailSender,
      responsibleRepository,
    ),
    // Segunda dependência: RF21 (POST /me/verification).
    advertiserVerificationService,
  );

  const advertiserVerificationController = new AdvertiserVerificationController(
    advertiserVerificationService,
  );

  // Task 12: preços (RF39) e configurações. O service de preços também é o
  // ponto de leitura da task 13, que copia o valor na vaga ao enviá-la para
  // pagamento (RN-P8).
  const vacancyPriceService = new VacancyPriceService(
    new VacancyPriceRepository(AppDataSource.getRepository(VacancyPrice)),
  );
  const settingService = new SettingService(
    new SettingRepository(AppDataSource.getRepository(Setting)),
  );
  const pricingController = new PricingController(
    vacancyPriceService,
    settingService,
  );

  // Task 13: as vagas. O VacancyPriceService entra aqui porque é no ENVIO
  // da vaga que o preço é copiado (RN-P8) — a vaga não relê a tabela depois.
  // Task 14: o pagamento por PIX. Recebe o REPOSITÓRIO de vagas, não o
  // service: o que ele faz é mudar a situação da vaga a partir da decisão
  // do admin, sem passar pelas regras do fluxo do anunciante.
  const vacancyRepository = new VacancyRepository(
    AppDataSource.getRepository(Vacancy),
  );

  const paymentService = new PaymentService(
    new PaymentRepository(AppDataSource.getRepository(Payment)),
    vacancyRepository,
    advertiserRepository,
    adminRepository,
    emailSender,
  );
  const paymentController = new PaymentController(paymentService);

  const vacancyController = new VacancyController(
    new VacancyService(
      vacancyRepository,
      advertiserRepository,
      responsibleRepository,
      vacancyPriceService,
      // Task 14: a tela de pagamento (RF28) lê a chave PIX da configuração.
      settingService,
      // RF28: o envio da vaga paga avisa os admins de que há PIX a
      // conferir. Porta estreita (IPendingPaymentNotifier) para o módulo
      // de vagas não depender do de pagamento.
      paymentService,
    ),
  );

  // Task 15: a busca e a página pública (RF14, RF42). Service separado do
  // VacancyService de propósito: aquele é o fluxo do anunciante sobre as
  // vagas dele, este não tem identidade nenhuma.
  const publicVacancyController = new PublicVacancyController(
    new PublicVacancyService(vacancyRepository),
  );

  const authController = new AuthController(authService);
  const authenticate = makeAuthenticate(authService);

  const studentService = new StudentService(
    studentRepository,
    emailRegistry,
    hasher,
    authService,
  );
  const studentController = new StudentController(studentService);

  // The admin module ends sessions when it deactivates an admin or changes a
  // password (RN20 / RN21), hence the AuthService.
  const adminService = new AdminService(
    adminRepository,
    emailRegistry,
    authService,
    hasher,
    studentRepository,
  );
  const adminController = new AdminController(adminService);

  return {
    emailSender,
    singleUseTokens,
    studentController,
    authController,
    recoveryController,
    courseController,
    formationController,
    advertiserController,
    advertiserVerificationController,
    adminController,
    paymentController,
    pricingController,
    publicVacancyController,
    vacancyController,
    vacancyPriceService,
    settingService,
    authenticate,
  };
}
