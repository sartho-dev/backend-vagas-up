// SRS 6 (PAGAMENTO). A linha registra a DECISÃO do administrador sobre o
// PIX de uma vaga, não uma tentativa de pagamento: ela nasce quando o admin
// decide, porque é só aí que existem valor conferido, data e autor (RN-P7).
//
// A separação entre `RECUSADO` e `REEMBOLSADO` é pelo dinheiro recebido,
// decidida em 21/10/2026:
//   CONFIRMADO  — o PIX conferiu; a vaga abre.
//   RECUSADO    — o PIX não conferiu (não chegou, valor errado). Não há o
//                 que devolver.
//   REEMBOLSADO — o PIX chegou, mas o admin recusa publicar a vaga, e o
//                 dinheiro volta. É o reembolso da RN-P6, que só existe
//                 antes da publicação.
export enum PaymentSituation {
  CONFIRMED = "confirmado",
  REFUSED = "recusado",
  REFUNDED = "reembolsado",
}

// RN-P6: o reembolso só existe antes da publicação. Depois de aberta, a
// vaga foi entregue; vaga encerrada por denúncia procedente não reembolsa.
export const REFUSAL_SITUATIONS: PaymentSituation[] = [
  PaymentSituation.REFUSED,
  PaymentSituation.REFUNDED,
];
