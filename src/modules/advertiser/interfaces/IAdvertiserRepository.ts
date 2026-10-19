import { Advertiser } from "../schema/Advertiser.schema";
import { Responsible } from "../schema/Responsible.schema";
import { AdvertiserType } from "../types/AdvertiserEnums";

export type RegisterAdvertiserData = {
  type: AdvertiserType;
  document: string;
  displayName: string;
  legalName: string | null;
  contactEmail: string;
  contactPhone: string;
  site: string | null;
  firstResponsible: {
    name: string;
    email: string;
    passwordHash: string;
  };
};

export type UpdateAdvertiserData = {
  displayName?: string;
  legalName?: string | null;
  contactEmail?: string;
  contactPhone?: string;
  site?: string | null;
};

// RN-VG8: tirar o último responsável ativo não pode deixar o anunciante sem
// ninguém. O repositório informa o que aconteceu; o service escolhe o HTTP.
export type DeactivateResponsibleOutcome =
  | "deactivated"
  | "not_found"
  | "already_inactive"
  | "last_active";

export interface IAdvertiserRepository {
  // RF20: anunciante e primeiro responsável nascem na MESMA transação —
  // um anunciante sem responsável seria inacessível para sempre.
  register(
    data: RegisterAdvertiserData,
  ): Promise<{ advertiser: Advertiser; responsible: Responsible }>;

  findById(id: string): Promise<Advertiser | null>;
  existsByDocument(document: string): Promise<boolean>;

  // RF23: tipo e documento não entram. Devolve null se não existir.
  update(id: string, data: UpdateAdvertiserData): Promise<Advertiser | null>;

  // RF23: alterar nome ou razão social de um anunciante VERIFICADO o devolve
  // para pendente — o selo foi dado àquele nome.
  resetVerification(id: string): Promise<void>;

  listResponsibles(advertiserId: string): Promise<Responsible[]>;
  addResponsible(
    advertiserId: string,
    data: { name: string; email: string; passwordHash: string },
  ): Promise<Responsible>;

  deactivateResponsible(
    id: string,
    advertiserId: string,
  ): Promise<DeactivateResponsibleOutcome>;
}
