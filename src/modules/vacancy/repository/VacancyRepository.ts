import { Not, Repository } from "typeorm";
import { Vacancy } from "../schema/Vacancy.schema";
import {
  CreateVacancyData,
  IVacancyRepository,
  VacancyTransition,
} from "../interfaces/IVacancyRepository";
import { VacancyPatch } from "../types/VacancyTypes";
import { VacancySituation } from "../types/VacancyEnums";

export class VacancyRepository implements IVacancyRepository {
  constructor(private repository: Repository<Vacancy>) {}

  async create(data: CreateVacancyData): Promise<Vacancy> {
    const vacancy = this.repository.create({
      ...data,
      situation: VacancySituation.DRAFT,
    });

    return await this.repository.save(vacancy);
  }

  async findById(id: string): Promise<Vacancy | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async findOwned(id: string, advertiserId: string): Promise<Vacancy | null> {
    return await this.repository.findOne({ where: { id, advertiserId } });
  }

  async listByAdvertiser(advertiserId: string): Promise<Vacancy[]> {
    return await this.repository.find({
      where: { advertiserId },
      order: { createdAt: "DESC" },
    });
  }

  async update(id: string, patch: VacancyPatch): Promise<Vacancy | null> {
    const result = await this.repository.update(
      { id },
      { ...patch, updatedAt: new Date() },
    );

    if (result.affected === 0) return null;

    return await this.findById(id);
  }

  async transition(
    id: string,
    data: VacancyTransition,
  ): Promise<Vacancy | null> {
    const result = await this.repository.update(
      { id },
      { ...data, updatedAt: new Date() },
    );

    if (result.affected === 0) return null;

    return await this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async countOpen(advertiserId: string): Promise<number> {
    return await this.repository.count({
      where: { advertiserId, situation: VacancySituation.OPEN },
    });
  }

  async hasUsedFreeVacancy(advertiserId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: {
        advertiserId,
        free: true,
        // O rascunho não consome a gratuita: só a partir do envio a vaga
        // passa a ocupar o direito.
        situation: Not(VacancySituation.DRAFT),
      },
    });

    return count > 0;
  }
}
