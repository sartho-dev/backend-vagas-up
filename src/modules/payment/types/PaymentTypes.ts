import { VacancyType } from "../../../shared/types/VacancyType";
import { VerificationStatus } from "../../advertiser/types/AdvertiserEnums";
import { PaymentSituation } from "./PaymentEnums";

// RF37: uma linha da fila. O admin precisa de tudo isto na tela para
// conferir o PIX no extrato sem abrir cada vaga.
export type PaymentQueueItem = {
  vacancyId: string;
  title: string;
  type: VacancyType;
  value: number;
  // É por este código que o admin acha o pagamento no extrato (RN-P3).
  referenceCode: string;
  advertiserId: string;
  advertiserName: string;
  advertiserDocument: string;
  // RN-P2: só o verificado publica vaga paga. Aparece na fila porque uma
  // vaga que chegou aqui e perdeu a verificação depois não pode ser
  // confirmada — e o admin vê o motivo antes de tentar.
  advertiserVerification: VerificationStatus;
  // Desde quando espera: é o que define a ordem da fila.
  awaitingSince: Date;
};

export type PaymentResult = {
  id: string;
  vacancyId: string;
  value: number;
  referenceCode: string;
  situation: PaymentSituation;
  decidedBy: string;
  decidedAt: Date;
  note: string | null;
};
