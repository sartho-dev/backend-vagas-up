import { ISettingRepository } from "../interfaces/IPricingRepository";
import { SETTING_KEYS, SettingKey } from "../types/PricingEnums";
import { SettingResult } from "../types/PricingTypes";

export class SettingService {
  constructor(private repository: ISettingRepository) {}

  // Devolve TODAS as chaves conhecidas, configuradas ou não. O painel
  // precisa da lista completa para oferecer o campo de cada uma; devolver
  // só as linhas existentes esconderia do admin o que ele pode configurar.
  async listService(): Promise<SettingResult[]> {
    const stored = new Map(
      (await this.repository.list()).map((s) => [s.key, s]),
    );

    return SETTING_KEYS.map((key) => {
      const setting = stored.get(key);

      return {
        key,
        value: setting?.value ?? null,
        updatedBy: setting?.updatedBy ?? null,
        updatedAt: setting?.updatedAt ?? null,
      };
    });
  }

  // RNF07: guarda o autor. `value: null` apaga a configuração.
  async updateService(
    adminId: string,
    key: SettingKey,
    value: string | null,
  ): Promise<SettingResult> {
    if (value === null) {
      await this.repository.remove(key);

      return { key, value: null, updatedBy: null, updatedAt: null };
    }

    const setting = await this.repository.upsert(key, value, adminId);

    return {
      key: setting.key,
      value: setting.value,
      updatedBy: setting.updatedBy,
      updatedAt: setting.updatedAt,
    };
  }

  // Gancho para quem consome a configuração: a RF41 (convite da comunidade)
  // e a RF40 ("Anuncie aqui"). Devolve null quando não configurada, e quem
  // chama decide o que fazer — a RF41 simplesmente não mostra o convite.
  async valueOfService(key: SettingKey): Promise<string | null> {
    const setting = await this.repository.findByKey(key);

    return setting?.value ?? null;
  }
}
