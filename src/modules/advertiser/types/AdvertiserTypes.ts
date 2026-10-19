import { AdvertiserType, VerificationStatus } from "./AdvertiserEnums";

export type AdvertiserResult = {
  id: string;
  type: AdvertiserType;
  document: string;
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
