// RF24: tipo da vaga. Mora em `shared` porque dois domínios dependem dele e
// nenhum é dono: a tabela de preços é chaveada por tipo (RF39, task 12) e a
// vaga guarda o seu (task 13). Deixá-lo em um dos dois faria o outro
// importar um módulo com que não tem relação.
//
// Os valores são os do SRS (seção 6), em português, porque viram enum no
// banco e aparecem na URL da rota de preços.
export enum VacancyType {
  INTERNSHIP = "estagio",
  EMPLOYMENT = "emprego",
  APPRENTICE = "jovem_aprendiz",
}
