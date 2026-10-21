import { AppError } from "../../../shared/errors/AppError";
import { VacancyType } from "../../../shared/types/VacancyType";
import { IVacancyPriceRepository } from "../interfaces/IPricingRepository";
import { VacancyPrice } from "../schema/VacancyPrice.schema";
import { VacancyPriceResult } from "../types/PricingTypes";

function toResult(price: VacancyPrice): VacancyPriceResult {
  return {
    type: price.type,
    value: price.value,
    updatedBy: price.updatedBy,
    updatedAt: price.updatedAt,
  };
}

export class VacancyPriceService {
  constructor(private repository: IVacancyPriceRepository) {}

  // RF39
  async listService(): Promise<VacancyPriceResult[]> {
    const prices = await this.repository.list();

    return prices.map(toResult);
  }

  // RF39 + RNF07: a alteração guarda quem e quando.
  async updateService(
    adminId: string,
    type: VacancyType,
    value: number,
  ): Promise<VacancyPriceResult> {
    const price = await this.repository.update(type, value, adminId);

    // Só chega aqui se o enum ganhou um tipo sem a migration da linha.
    if (!price) {
      throw new AppError("Preço não encontrado para este tipo de vaga", 404);
    }

    return toResult(price);
  }

  // RN-P8: é AQUI que a task 13 pega o valor no momento em que a vaga é
  // enviada para pagamento, para copiá-lo na linha da vaga. A mudança de
  // preço não volta atrás porque ninguém relê este método depois: a vaga
  // carrega a cópia, e é ela que aparece no PIX e no pagamento.
  async priceOfService(type: VacancyType): Promise<number> {
    const price = await this.repository.findByType(type);

    if (!price) {
      throw new AppError("Preço não encontrado para este tipo de vaga", 404);
    }

    return price.value;
  }
}
