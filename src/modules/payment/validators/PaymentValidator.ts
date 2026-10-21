import { z } from "zod";
import { PaymentSituation } from "../types/PaymentEnums";

export const vacancyIdParamSchema = z.object({
  vacancyId: z.uuid("Vaga inválida"),
});

// A observação é opcional na confirmação: o caso normal é "o PIX bateu" e
// não há o que escrever. Quando há (valor a mais, pagamento em duas
// parcelas), é aqui que fica para quem auditar depois.
export const confirmPaymentSchema = z
  .object({
    note: z.string().trim().max(1000).nullable().default(null),
  })
  .strict();

// RF37: recusar exige MOTIVO. Sem ele o anunciante recebe uma vaga
// encerrada e nenhuma explicação, e o admin não tem como justificar a
// decisão depois.
//
// `moneyReceived` escolhe entre as duas recusas da RN-P6: sem dinheiro na
// conta é `recusado`; com dinheiro é `reembolsado`. Não tem padrão de
// propósito — o admin tem de olhar o extrato e dizer, porque a resposta
// decide se alguém vai devolver dinheiro.
export const rejectPaymentSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(10, "Explique o motivo em ao menos 10 caracteres")
      .max(1000, "O motivo deve ter no máximo 1000 caracteres"),
    moneyReceived: z.boolean({
      error: "Informe se o pagamento foi recebido",
    }),
  })
  .strict();

// Paginação igual à da fila de verificação (RF30).
export const paymentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// RF37: "ver pagamentos por período". Os dois limites são opcionais.
export const listPaymentsQuerySchema = paymentQuerySchema
  .extend({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    situation: z.enum(PaymentSituation).optional(),
  })
  .refine(
    (q) => !q.from || !q.to || q.from.getTime() <= q.to.getTime(),
    "O início do período não pode ser depois do fim",
  );

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
export type RejectPaymentInput = z.infer<typeof rejectPaymentSchema>;
