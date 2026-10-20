import { AdvertiserType, VerificationStatus } from "./AdvertiserEnums";

export type AdvertiserResult = {
  id: string;
  type: AdvertiserType;
  cnpj: string;
  displayName: string;
  legalName: string | null;
  contactEmail: string;
  contactPhone: string;
  site: string | null;
  verification: VerificationStatus;
  active: boolean;
};

export type ResponsibleResult = {
  id: string;
  name: string;
  email: string;
  active: boolean;
};

export type VerificationQueueItem = {
  id: string;
  type: AdvertiserType;
  cnpj: string;
  displayName: string;
  legalName: string | null;
  contactEmail: string;
  contactPhone: string;
  verificationRequestedAt: Date;
};

export type AdvertiserDetailForAdmin = AdvertiserResult & {
  verifiedBy: string | null;
  verifiedAt: Date | null;
  verificationMethod: string | null;
  rejectionReason: string | null;
  verificationRequestedAt: Date | null;
  responsibles: ResponsibleResult[];
};
