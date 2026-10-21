import { randomInt } from "crypto";

// RN-P3: o código vai na DESCRIÇÃO DO PIX, digitado à mão por quem paga e
// lido à mão pelo admin que confere. Por isso o alfabeto não tem O, 0, I, 1
// nem U: os quatro primeiros se confundem entre si em qualquer fonte, e o U
// evita que o sorteio forme palavra ofensiva.
//
// Base32 de Crockford sem U. 8 caracteres = 31^8 ≈ 8,5e11 combinações: com
// as centenas de milhares de vagas que o projeto espera, a chance de
// colisão é desprezível. Mesmo assim a coluna é UNIQUE e quem chama tenta
// de novo — um código repetido faria dois PIX indistinguíveis.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTVWXYZ";
const LENGTH = 8;

export function generateReferenceCode(): string {
  let code = "";

  for (let i = 0; i < LENGTH; i += 1) {
    // randomInt e não Math.random: o código identifica um pagamento, e um
    // gerador previsível deixaria adivinhar o código de outra vaga.
    code += ALPHABET[randomInt(ALPHABET.length)];
  }

  return code;
}
