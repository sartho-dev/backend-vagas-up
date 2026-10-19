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
import { EmailRegistry, IEmailLookup } from "../services/EmailRegistry";
import {
  BcryptPasswordHasher,
  IPasswordHasher,
} from "../services/PasswordHasher";

export type ContainerOptions = {
  passwordHasher?: IPasswordHasher;
  // Os testes injetam o TestEmailSender; sem SMTP configurado, cai no
  // ConsoleEmailSender para a aplicação subir numa máquina nova.
  emailSender?: IEmailSender;
};

export type Container = ReturnType<typeof buildContainer>;

export function buildContainer(options: ContainerOptions = {}) {
  const hasher = options.passwordHasher ?? new BcryptPasswordHasher();

  const emailSender =
    options.emailSender ??
    (config.mail.host && config.mail.user
      ? new SmtpEmailSender()
      : new ConsoleEmailSender());

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

  // RN06: one email, one account, across every kind of account. When the
  // responsible module exists, add its repository to this map.
  const emailRegistry = new EmailRegistry(
    new Map<AccountRole, IEmailLookup>([
      [AccountRole.STUDENT, studentRepository],
      [AccountRole.ADMIN, adminRepository],
      [AccountRole.RESPONSIBLE, responsibleRepository],
    ]),
  );

  // When the responsible module exists, add its provider to this array.
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
    new CourseService(new CourseRepository(AppDataSource.getRepository(Course))),
  );

  const formationController = new FormationController(
    new FormationService(
      new FormationRepository(AppDataSource.getRepository(Formation)),
    ),
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
    adminController,
    authenticate,
  };
}
