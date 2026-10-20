import { Advertiser } from "../schema/Advertiser.schema";
import { Responsible } from "../schema/Responsible.schema";
import { AdvertiserType, VerificationMethod } from "../types/AdvertiserEnums";

export type RegisterAdvertiserData = {
  type: AdvertiserType;
  cnpj: string;
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

export type RequestVerificationOutcome =
  | "requested"
  | "not_found"
  | "already_verified"
  | "already_pending";

export type DecideVerificationOutcome =
  | "decided"
  | "not_found"
  | "already_verified"
  | "already_rejected";

export type DecideVerificationInput = {
  decision: "verify" | "reject";
  method: VerificationMethod | null;
  reason: string | null;
  adminId: string;
};

export type ListPendingVerificationOptions = {
  page: number;
  limit: number;
};

export type ListPendingVerificationResult = {
  items: Advertiser[];
  total: number;
};

export interface IAdvertiserRepository {
  // RF20: anunciante e primeiro responsável nascem na MESMA transação —
  // um anunciante sem responsável seria inacessível para sempre.
  register(
    data: RegisterAdvertiserData,
  ): Promise<{ advertiser: Advertiser; responsible: Responsible }>;

  findById(id: string): Promise<Advertiser | null>;
  existsByDocument(cnpj: string): Promise<boolean>;

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

  requestVerification(id: string): Promise<RequestVerificationOutcome>;

  // RF30
  listPendingVerification(
    options: ListPendingVerificationOptions,
  ): Promise<ListPendingVerificationResult>;

  // RF30 + RNF07: quem decidiu, quando e por qual método.
  decideVerification(
    id: string,
    input: DecideVerificationInput,
  ): Promise<DecideVerificationOutcome>;
}
