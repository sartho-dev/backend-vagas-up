import { VacancyType } from "../../../shared/types/VacancyType";

// RN-VG1: as cinco situações, na ordem em que a vaga as percorre.
// `ENCERRADA` é final — não reabre. Quem quiser continuar contratando
// publica outra vaga, com novo pagamento (RN-VG3).
//
// `SUSPENSA` entra por denúncia procedente (RF31, task 20); nenhuma rota
// desta task leva a vaga até lá, mas o valor nasce aqui porque é o enum do
// banco e acrescentá-lo depois custaria uma migration só para isso.
export enum VacancySituation {
  DRAFT = "rascunho",
  AWAITING_PAYMENT = "aguardando_pagamento",
  OPEN = "aberta",
  SUSPENDED = "suspensa",
  CLOSED = "encerrada",
}

// RF24: modalidade de trabalho.
export enum VacancyModality {
  ON_SITE = "presencial",
  REMOTE = "remoto",
  HYBRID = "hibrido",
}

// RN-P5: só estas duas situações aceitam edição. Depois de publicada, a
// vaga é imutável — os dados foram conferidos na revisão (RF29) e os
// candidatos se inscreveram com base neles.
export const EDITABLE_SITUATIONS: VacancySituation[] = [
  VacancySituation.DRAFT,
  VacancySituation.AWAITING_PAYMENT,
];

// RN-VG4: carga horária máxima por tipo de vaga.
//
// ATENÇÃO À UNIDADE: estágio e emprego são limites SEMANAIS (Lei
// 11.788/2008 art. 10 e CLT); jovem aprendiz é DIÁRIO (CLT art. 432).
// A coluna `work_hours` guarda o número que o anunciante digitou, no que
// vale para o tipo dele — decisão tomada em 21/10/2026 para que o limite
// legal seja aplicado na mesma unidade em que a lei o escreve. Converter o
// jovem aprendiz para 30 h semanais recusaria 7 h diárias por "35 > 30", e
// não por "7 > 6", que é a regra de verdade.
//
// Consequência para quem exibe a vaga (task 15): o rótulo da carga horária
// depende do tipo. Por isso WORK_HOURS_UNIT vive aqui, ao lado do limite,
// e não na camada de apresentação.
export const WORK_HOURS_LIMIT: Record<VacancyType, number> = {
  [VacancyType.INTERNSHIP]: 30,
  [VacancyType.EMPLOYMENT]: 44,
  [VacancyType.APPRENTICE]: 6,
};

export const WORK_HOURS_UNIT: Record<VacancyType, "semanal" | "diaria"> = {
  [VacancyType.INTERNSHIP]: "semanal",
  [VacancyType.EMPLOYMENT]: "semanal",
  [VacancyType.APPRENTICE]: "diaria",
};

// RN-VG2 / RN-P4: a vaga vale 60 dias contados da publicação, sem
// renovação. O encerramento automático é a rotina diária da task 22; esta
// task só grava `expires_at` na publicação.
export const VACANCY_VALIDITY_DAYS = 60;

// RN-V3a: anunciante PF tem no máximo 3 vagas ABERTAS ao mesmo tempo,
// mesmo verificado e pagando.
export const INDIVIDUAL_OPEN_VACANCY_LIMIT = 3;
