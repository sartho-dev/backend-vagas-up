import { EducationLevel } from "../../student/types/StudentEnums";
import { VacancyType } from "../../../shared/types/VacancyType";
import { VacancyModality, VacancySituation } from "../types/VacancyEnums";

// Campos que o anunciante preenche (RF24). Os mesmos no cadastro e na
// edição — a edição só muda quem pode chamá-la (RN-P5).
export type VacancyInput = {
  type: VacancyType;
  title: string;
  description: string;
  modality: VacancyModality;
  city: string;
  workHours: number;
  minEducation: EducationLevel;
  requiresAdult: boolean;
  positions: number;
  courseId: string | null;
  requirements: string | null;
  benefits: string | null;
  compensation: string | null;
  schedule: string | null;
  deadline: Date | null;
};

// A edição manda só o que muda.
export type VacancyPatch = Partial<VacancyInput>;

// O que as rotas do responsável devolvem. `workHoursUnit` vai junto porque
// o número sozinho é ambíguo: 6 significa 6 h diárias num jovem aprendiz e
// 6 h semanais em nada (RN-VG4).
export type VacancyResult = {
  id: string;
  advertiserId: string;
  createdBy: string;
  type: VacancyType;
  title: string;
  description: string;
  modality: VacancyModality;
  city: string;
  workHours: number;
  workHoursUnit: "semanal" | "diaria";
  minEducation: EducationLevel;
  requiresAdult: boolean;
  positions: number;
  courseId: string | null;
  requirements: string | null;
  benefits: string | null;
  compensation: string | null;
  schedule: string | null;
  deadline: Date | null;
  situation: VacancySituation;
  free: boolean;
  value: number | null;
  referenceCode: string;
  publishedAt: Date | null;
  expiresAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
};

// RF28: o que a tela de pagamento mostra ao responsável. Tudo o que ele
// precisa para fazer o PIX e nada mais.
export type VacancyPaymentInfo = {
  vacancyId: string;
  title: string;
  value: number;
  // RN-P3: vai na DESCRIÇÃO do PIX. Sem ele o admin não acha o pagamento
  // no extrato, e a vaga fica parada na fila.
  referenceCode: string;
  // Nulo quando o administrador ainda não configurou a chave (RF28). A tela
  // avisa em vez de o envio da vaga falhar — travar a publicação por uma
  // configuração vazia deixaria o anunciante sem saída nenhuma.
  pixKey: string | null;
  // RN-P4: o aviso de validade aparece na revisão E na tela de pagamento.
  validityDays: number;
};

// RN-V6: o aviso anti-golpe, palavra por palavra como o SRS o escreve.
// Mora aqui, e não na camada de apresentação, porque a regra manda que ele
// esteja em TODA página de vaga — deixar o front decidir se mostra faria a
// regra depender de quem escreve a tela.
export const SCAM_WARNING =
  "Nenhuma vaga legítima cobra taxa, curso ou material. " +
  "Se pedirem dinheiro, denuncie.";

// O que a busca pública devolve por vaga. É um subconjunto deliberado do
// `VacancyResult`: nada de `value`, `free`, `referenceCode`, `createdBy`
// nem documento ou contato do anunciante.
//
// `value` e `free` são a relação comercial entre o anunciante e o site, e
// não dizem nada ao candidato. `referenceCode` é identificador de pagamento
// (RN-P3). O contato do anunciante fica fora porque a candidatura acontece
// DENTRO do site (task 16): publicar e-mail e telefone aqui entregaria os
// dois a qualquer raspador de página e tiraria do site o fluxo que ele
// existe para intermediar.
export type PublicVacancySummary = {
  id: string;
  // RF42: é por ele que a página é montada, `/vagas/<slug>`.
  slug: string;
  title: string;
  type: VacancyType;
  modality: VacancyModality;
  city: string;
  workHours: number;
  workHoursUnit: "semanal" | "diaria";
  minEducation: EducationLevel;
  requiresAdult: boolean;
  positions: number;
  compensation: string | null;
  deadline: Date | null;
  publishedAt: Date;
  advertiserName: string;
  // RN-V4 / RN-V5: selo "Verificado" ou o aviso de não verificado. Vem
  // calculado, e não como o enum de verificação cru, porque o que a página
  // mostra é binário: tem selo ou tem aviso.
  advertiserVerified: boolean;
};

// A página da vaga (RF42). Tem o texto todo, que a busca não devolve para
// não carregar 20 descrições inteiras numa listagem.
export type PublicVacancyDetail = PublicVacancySummary & {
  description: string;
  requirements: string | null;
  benefits: string | null;
  schedule: string | null;
  courseId: string | null;
  courseName: string | null;
  expiresAt: Date;
};
