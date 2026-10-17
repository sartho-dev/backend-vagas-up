// RN-C2: lista fixa de escolaridade. A ordem importa: a RN-C3 compara a
// escolaridade do candidato com a mínima da vaga, e a comparação usa a
// posição nesta lista. Inserir um nível novo no meio muda a ordem — por isso
// a ordem é a regra, não um detalhe de apresentação.
export enum EducationLevel {
  FUNDAMENTAL_INCOMPLETE = "fundamental_incompleto",
  FUNDAMENTAL_COMPLETE = "fundamental_completo",
  HIGH_SCHOOL_IN_PROGRESS = "medio_em_andamento",
  HIGH_SCHOOL_COMPLETE = "medio_completo",
  TECHNICAL_IN_PROGRESS = "tecnico_em_andamento",
  TECHNICAL_COMPLETE = "tecnico_completo",
  UNDERGRADUATE_IN_PROGRESS = "superior_em_andamento",
  UNDERGRADUATE_COMPLETE = "superior_completo",
  POSTGRADUATE = "pos_graduacao",
}

// Ordem crescente, usada pela RN-C3 (task 16).
export const EDUCATION_LEVEL_ORDER: EducationLevel[] = [
  EducationLevel.FUNDAMENTAL_INCOMPLETE,
  EducationLevel.FUNDAMENTAL_COMPLETE,
  EducationLevel.HIGH_SCHOOL_IN_PROGRESS,
  EducationLevel.HIGH_SCHOOL_COMPLETE,
  EducationLevel.TECHNICAL_IN_PROGRESS,
  EducationLevel.TECHNICAL_COMPLETE,
  EducationLevel.UNDERGRADUATE_IN_PROGRESS,
  EducationLevel.UNDERGRADUATE_COMPLETE,
  EducationLevel.POSTGRADUATE,
];

// RN-C9: quem enxerga o perfil do candidato.
//   OCULTO        — só os anunciantes das vagas a que ele se candidatou
//   SO_VERIFICADOS— aparece também no banco de talentos (RF27)
//   PUBLICO       — aparece ainda no mural sem login (RF19)
// Padrão é OCULTO: ninguém é exposto sem escolher (SRS 9.1).
export enum ProfileVisibility {
  HIDDEN = "oculto",
  VERIFIED_ONLY = "so_verificados",
  PUBLIC = "publico",
}

// RN-C9: menor de 18 não pode escolher PUBLICO.
export const PUBLIC_VISIBILITY_MIN_AGE = 18;
