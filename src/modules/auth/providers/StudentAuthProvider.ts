import {
  IAuthAccountProvider,
  LoginAccount,
} from "../interfaces/IAuthAccountProvider";
import { IStudentRepository } from "../../student/interfaces/IStudentRepository";
import { AccountRole } from "../types/AccountRole";

export class StudentAuthProvider implements IAuthAccountProvider {
  readonly role = AccountRole.STUDENT;

  constructor(private students: IStudentRepository) {}

  async findForLogin(email: string): Promise<LoginAccount | null> {
    // RF01: findByEmailWithPassword is the only query that returns the hash,
    // and it only returns active students.
    const student = await this.students.findByEmailWithPassword(email);

    return student
      ? {
          id: student.id,
          passwordHash: student.passwordHash,
          failedLogins: student.failedLogins,
          blockedUntil: student.blockedUntil,
        }
      : null;
  }

  async isActive(accountId: string): Promise<boolean> {
    return await this.students.existsActiveById(accountId);
  }

  // RN-A4
  async recordLoginFailure(
    accountId: string,
    failedLogins: number,
    blockedUntil: Date | null,
  ): Promise<void> {
    await this.students.recordLoginFailure(accountId, failedLogins, blockedUntil);
  }

  // RN-A4
  async clearLoginFailures(accountId: string): Promise<void> {
    await this.students.clearLoginFailures(accountId);
  }
}
