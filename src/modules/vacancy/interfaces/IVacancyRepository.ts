import { EducationLevel } from "../../student/types/StudentEnums";
import { VacancyType } from "../../../shared/types/VacancyType";
import { Vacancy } from "../schema/Vacancy.schema";
import { VacancyModality } from "../types/VacancyEnums";
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

// RF14: os filtros da busca pública. Todos opcionais e combináveis.
export type SearchVacanciesOptions = {
  type?: VacancyType;
  modality?: VacancyModality;
  city?: string;
  minEducation?: EducationLevel;
  courseId?: string;
  keyword?: string;
  page: number;
  limit: number;
  // Recebido de fora em vez de lido com `new Date()` aqui: é o corte de
  // "dentro do prazo", e um teste precisa poder escolher o instante.
  now: Date;
};

export type SearchVacanciesResult = {
  // Com o anunciante carregado: cada vaga mostra selo "Verificado" ou o
  // aviso de não verificado (RN-V4, RN-V5), e uma consulta por linha
  // estouraria os 2 s da RNF04.
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

  // A publicação é um método próprio, e não um `transition` com mais
  // campos, porque é a única transição que precisa gerar o endereço público
  // (RF42). Ela acontece em DOIS lugares — o envio da vaga gratuita (task
  // 13) e a confirmação do PIX (task 14) —, e deixar a geração do slug aqui
  // garante que os dois caminhos a façam igual, inclusive o laço de
  // colisão.
  // `extra` existe para o caminho da vaga GRATUITA, que decide `free` e
  // `value` no mesmo instante em que publica (RN-P1). Sem ele, aquele
  // caminho precisaria de dois UPDATE para um só evento.
  publish(
    id: string,
    publishedAt: Date,
    expiresAt: Date,
    extra?: { free?: boolean; value?: number | null },
  ): Promise<Vacancy | null>;

  transition(id: string, data: VacancyTransition): Promise<Vacancy | null>;

  remove(id: string): Promise<void>;

  // RN-V3a: quantas vagas ABERTAS o anunciante tem agora.
  countOpen(advertiserId: string): Promise<number>;

  // RF14 + RNF04: a busca pública. Só vaga aberta e dentro do prazo.
  search(options: SearchVacanciesOptions): Promise<SearchVacanciesResult>;

  // RF42: a página pública é encontrada pelo endereço legível, não pelo id.
  findPublicBySlug(slug: string, now: Date): Promise<Vacancy | null>;

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
