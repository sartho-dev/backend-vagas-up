import { SettingKey } from "./PricingEnums";
import { VacancyType } from "../../../shared/types/VacancyType";

export type VacancyPriceResult = {
  type: VacancyType;
  value: number;
  updatedBy: string | null;
  updatedAt: Date;
};

// Chave conhecida que ainda não foi configurada aparece com `value: null`:
// o painel precisa saber que a chave existe para oferecer o campo. Sem
// isso, o admin não teria como descobrir que pode configurar o link da
// comunidade.
export type SettingResult = {
  key: SettingKey;
  value: string | null;
  updatedBy: string | null;
  updatedAt: Date | null;
};
