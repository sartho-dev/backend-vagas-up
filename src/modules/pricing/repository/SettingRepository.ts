import { Repository } from "typeorm";
import { Setting } from "../schema/Setting.schema";
import { ISettingRepository } from "../interfaces/IPricingRepository";
import { SettingKey } from "../types/PricingEnums";

export class SettingRepository implements ISettingRepository {
  constructor(private repository: Repository<Setting>) {}

  async list(): Promise<Setting[]> {
    return await this.repository.find({ order: { key: "ASC" } });
  }

  async findByKey(key: SettingKey): Promise<Setting | null> {
    return await this.repository.findOne({ where: { key } });
  }

  async upsert(
    key: SettingKey,
    value: string,
    adminId: string,
  ): Promise<Setting> {
    // `upsert` do TypeORM vira INSERT ... ON CONFLICT DO UPDATE: um comando
    // só, sem a janela entre "existe?" e "escreve" que dois admins
    // salvando ao mesmo tempo transformariam em erro de chave duplicada.
    await this.repository.upsert(
      { key, value, updatedBy: adminId, updatedAt: new Date() },
      ["key"],
    );

    // O upsert não devolve a linha completa (nem o default de updated_at),
    // por isso a releitura.
    return (await this.findByKey(key))!;
  }

  async remove(key: SettingKey): Promise<void> {
    await this.repository.delete({ key });
  }
}
