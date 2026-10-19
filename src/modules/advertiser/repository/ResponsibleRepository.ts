import { Not, Repository } from "typeorm";
import { Responsible } from "../schema/Responsible.schema";
import { IResponsibleRepository } from "../interfaces/IResponsibleRepository";

export class ResponsibleRepository implements IResponsibleRepository {
  constructor(private repository: Repository<Responsible>) {}

  // RF01: o único lugar que devolve o hash, junto com o estado do bloqueio
  // (RN-A4). Só contas ATIVAS — conta desativada não entra.
  async findByEmailWithPassword(email: string): Promise<Responsible | null> {
    return await this.repository.findOne({
      where: { email, active: true },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        active: true,
        failedLogins: true,
        blockedUntil: true,
      },
    });
  }

  async existsActiveById(id: string): Promise<boolean> {
    return await this.repository.exists({ where: { id, active: true } });
  }

  async findById(id: string): Promise<Responsible | null> {
    return await this.repository.findOne({ where: { id } });
  }

  // RN-A7: inclui desativados de propósito — o e-mail continua ocupado.
  async existsByEmail(email: string): Promise<boolean> {
    return await this.repository.exists({ where: { email } });
  }

  async isEmailTakenByOther(
    email: string,
    accountId: string,
  ): Promise<boolean> {
    return await this.repository.exists({
      where: { email, id: Not(accountId) },
    });
  }

  async recordLoginFailure(
    accountId: string,
    failedLogins: number,
    blockedUntil: Date | null,
  ): Promise<void> {
    await this.repository.update({ id: accountId }, { failedLogins, blockedUntil });
  }

  async clearLoginFailures(accountId: string): Promise<void> {
    await this.repository.update(
      { id: accountId },
      { failedLogins: 0, blockedUntil: null },
    );
  }

  async updatePassword(accountId: string, passwordHash: string): Promise<void> {
    await this.repository.update({ id: accountId }, { passwordHash });
  }

  async updateEmail(accountId: string, email: string): Promise<void> {
    await this.repository.update({ id: accountId }, { email });
  }
}
