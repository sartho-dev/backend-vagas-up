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

  // RN06: one email, one account, across every kind of account. When the
  // responsible module exists, add its repository to this map.
  const emailRegistry = new EmailRegistry(
    new Map<AccountRole, IEmailLookup>([
      [AccountRole.STUDENT, studentRepository],
      [AccountRole.ADMIN, adminRepository],
    ]),
  );

  // When the responsible module exists, add its provider to this array.
  const authService = new AuthService(
    [
      new StudentAuthProvider(studentRepository),
      new AdminAuthProvider(adminRepository),
    ],
    new SessionRepository(AppDataSource.getRepository(Session)),
    hasher,
  );
  const recoveryService = new AccountRecoveryService(
    [
      new StudentAuthProvider(studentRepository),
      new AdminAuthProvider(adminRepository),
    ],
    singleUseTokens,
    emailRegistry,
    emailSender,
    hasher,
    authService,
  );
  const recoveryController = new RecoveryController(recoveryService);

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
    adminController,
    authenticate,
  };
}
