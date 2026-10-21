// Tabela `settings` (SRS 6: CONFIGURACAO). As chaves são um conjunto FECHADO
// de propósito: uma tabela chave-valor sem lista de chaves aceita qualquer
// coisa e, em seis meses, ninguém sabe mais quais linhas o sistema lê de
// verdade. Chave nova = uma linha neste enum e uma no validador.
export enum SettingKey {
  // RF41: link da comunidade de anunciantes no WhatsApp.
  ADVERTISER_COMMUNITY_URL = "advertiser_community_url",
  // RF40: contato do administrador na página "Anuncie aqui".
  SPONSORSHIP_CONTACT = "sponsorship_contact",
  // RF28 / RN-P3: a chave PIX que o anunciante vê na tela de pagamento da
  // vaga. Fica em configuração, e não no código, porque trocar a chave da
  // conta não pode exigir deploy — e porque ela aparece numa tela que o
  // anunciante usa para mandar dinheiro.
  PIX_KEY = "pix_key",
}

export const SETTING_KEYS = Object.values(SettingKey);
