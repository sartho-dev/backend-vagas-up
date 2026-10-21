import { Vacancy } from "../schema/Vacancy.schema";
import { VacancyInput, VacancyPatch } from "../types/VacancyTypes";

export type CreateVacancyData = VacancyInput & {
  advertiserId: string;
  createdBy: string;
  referenceCode: string;
};

// Campos que só o fluxo de publicação escreve. Ficam fora de VacancyPatch
// de propósito: `situation`, `value` e `free` não são editáveis pelo
// anunciante, e misturá-los no mesmo tipo da edição abriria a porta para um
// PATCH publicar a própria vaga sem pagar.
export type VacancyTransition = {
  situation: Vacancy["situation"];
  free?: boolean;
  value?: number | null;
  publishedAt?: Date | null;
  expiresAt?: Date | null;
  closedAt?: Date | null;
};

export type ListAwaitingPaymentOptions = {
  page: number;
  limit: number;
};

export type ListAwaitingPaymentResult = {
  // Com o anunciante carregado: a fila do admin (RF37) mostra de quem é a
  // vaga e se o anunciante está verificado, sem uma consulta por linha.
  items: Vacancy[];
  total: number;
};

export interface IVacancyRepository {
  create(data: CreateVacancyData): Promise<Vacancy>;

  findById(id: string): Promise<Vacancy | null>;

  // Escopada pelo anunciante, e não só pelo id: é o filtro de posse das
  // rotas `/me`. Mesma escolha da task 09 para as formações — a vaga de
  // outro anunciante dá 404, porque nesse escopo ela não existe, e um 403
  // confirmaria que aquele id existe em algum lugar.
  findOwned(id: string, advertiserId: string): Promise<Vacancy | null>;

  listByAdvertiser(advertiserId: string): Promise<Vacancy[]>;

  update(id: string, patch: VacancyPatch): Promise<Vacancy | null>;

  transition(id: string, data: VacancyTransition): Promise<Vacancy | null>;

  remove(id: string): Promise<void>;

  // RN-V3a: quantas vagas ABERTAS o anunciante tem agora.
  countOpen(advertiserId: string): Promise<number>;

  // RF37: a fila de pagamentos. A vaga em `aguardando_pagamento` É a fila —
  // não há linha de pagamento antes da decisão do admin (RN-P7).
  listAwaitingPayment(
    options: ListAwaitingPaymentOptions,
  ): Promise<ListAwaitingPaymentResult>;

  // RN-P1: se o anunciante já gastou a vaga gratuita. Conta a vaga marcada
  // `free` que saiu do rascunho — um rascunho não consome nada, e a vaga
  // excluída (RN-VG6) devolve o direito, porque a linha deixa de existir.
  hasUsedFreeVacancy(advertiserId: string): Promise<boolean>;
}
