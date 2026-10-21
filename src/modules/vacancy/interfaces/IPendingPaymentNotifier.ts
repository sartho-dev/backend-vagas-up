// RF28: quem avisa os administradores de que uma vaga entrou na fila de
// pagamento. A porta é estreita de propósito — o módulo de vagas não
// precisa conhecer o módulo de pagamento para disparar o aviso, só esta
// chamada. O PaymentService a satisfaz sem implementá-la explicitamente.
export interface IPendingPaymentNotifier {
  notifyAdminsOfPendingPaymentService(vacancy: {
    title: string;
    value: number;
    referenceCode: string;
    advertiserName: string;
  }): Promise<void>;
}
