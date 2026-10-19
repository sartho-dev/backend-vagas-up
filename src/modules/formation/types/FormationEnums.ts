// RF11: situação da formação declarada pelo candidato.
//
// A RN-C4 depende disto: vaga de estágio exige ao menos uma formação EM
// ANDAMENTO (Lei 11.788/2008 exige vínculo de ensino). "Trancada" não conta
// como em andamento — quem trancou não tem vínculo ativo.
export enum FormationStatus {
  IN_PROGRESS = "em_andamento",
  COMPLETED = "concluida",
  LOCKED = "trancada",
}
