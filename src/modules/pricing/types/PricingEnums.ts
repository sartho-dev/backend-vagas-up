// Tabela `settings` (SRS 6: CONFIGURACAO). As chaves são um conjunto FECHADO
// de propósito: uma tabela chave-valor sem lista de chaves aceita qualquer
// coisa e, em seis meses, ninguém sabe mais quais linhas o sistema lê de
// verdade. Chave nova = uma linha neste enum e uma no validador.
export enum SettingKey {
  // RF41: link da comunidade de anunciantes no WhatsApp.
  ADVERTISER_COMMUNITY_URL = "advertiser_community_url",
  // RF40: contato do administrador na página "Anuncie aqui".
  SPONSORSHIP_CONTACT = "sponsorship_contact",
}

export const SETTING_KEYS = Object.values(SettingKey);
