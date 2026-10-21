import { Setting } from "../schema/Setting.schema";
import { VacancyPrice } from "../schema/VacancyPrice.schema";
import { SettingKey } from "../types/PricingEnums";
import { VacancyType } from "../../../shared/types/VacancyType";

export interface IVacancyPriceRepository {
  // RF39: as três linhas existem desde a migration, então listar não tem
  // caso vazio.
  list(): Promise<VacancyPrice[]>;

  findByType(type: VacancyType): Promise<VacancyPrice | null>;

  // Devolve a linha já atualizada, ou null se o tipo não existe — o que só
  // acontece se alguém adicionar um valor ao enum sem a migration da linha.
  update(
    type: VacancyType,
    value: number,
    adminId: string,
  ): Promise<VacancyPrice | null>;
}

export interface ISettingRepository {
  list(): Promise<Setting[]>;

  findByKey(key: SettingKey): Promise<Setting | null>;

  // Insere ou atualiza: a linha nasce na primeira vez que o admin
  // configura a chave, não na migration (chave sem valor é ausência de
  // configuração, não string vazia).
  upsert(key: SettingKey, value: string, adminId: string): Promise<Setting>;

  // Apagar a linha é como se desliga a configuração — o `GET` volta a
  // devolver `value: null`. Guardar "" significaria "configurado como
  // vazio", que não é a mesma coisa.
  remove(key: SettingKey): Promise<void>;
}
