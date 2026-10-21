import { Repository } from "typeorm";
import { VacancyPrice } from "../schema/VacancyPrice.schema";
import { IVacancyPriceRepository } from "../interfaces/IPricingRepository";
import { VacancyType } from "../../../shared/types/VacancyType";

export class VacancyPriceRepository implements IVacancyPriceRepository {
  constructor(private repository: Repository<VacancyPrice>) {}

  async list(): Promise<VacancyPrice[]> {
    return await this.repository.find({ order: { type: "ASC" } });
  }

  async findByType(type: VacancyType): Promise<VacancyPrice | null> {
    return await this.repository.findOne({ where: { type } });
  }

  async update(
    type: VacancyType,
    value: number,
    adminId: string,
  ): Promise<VacancyPrice | null> {
    const result = await this.repository.update(
      { type },
      { value, updatedBy: adminId, updatedAt: new Date() },
    );

    if (result.affected === 0) return null;

    return await this.findByType(type);
  }
}
