import { Not, Repository } from "typeorm";
import { Admin } from "../schema/Admin.schema";
import { IAdminRepository } from "../interface/IAdminRepository";

export class AdminRepository implements IAdminRepository {
  constructor(private repository: Repository<Admin>) {}

  // RF01: passwordHash carries `select: false`, so it has to be asked for
  // explicitly. This is the only place that does so.
  async findByEmailWithPassword(email: string): Promise<Admin | null> {
    return await this.repository.findOne({
      where: { email, active: true },
      select: { id: true, email: true, passwordHash: true, active: true },
    });
  }

  async existsActiveById(id: string): Promise<boolean> {
    return await this.repository.exists({ where: { id, active: true } });
  }

  // RN06: deactivated admins are included on purpose, the email stays taken.
  async existsByEmail(email: string): Promise<boolean> {
    return await this.repository.exists({ where: { email } });
  }

  async isEmailTakenByOther(email: string, adminId: string): Promise<boolean> {
    return await this.repository.exists({
      where: { email, id: Not(adminId) },
    });
  }
}
