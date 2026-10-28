import { randomInt } from "crypto";

// RF42: cada vaga tem endereço próprio e LEGÍVEL, como
// `/vagas/vendedor-centro-k3m9qp`. O endereço é o que a pessoa vê colado no
// WhatsApp antes de clicar, então ele vale mais pelo que informa do que por
// ser curto: título e cidade primeiro, sufixo no fim.
//
// O sufixo é sorteado aqui e NÃO é o código de referência da vaga. Seria
// tentador reaproveitá-lo (já é único, dispensaria o laço de colisão), mas
// aquele código vai na descrição do PIX (RN-P3) — é identificador de
// pagamento, e identificador de pagamento não entra em URL pública.
const SUFFIX_ALPHABET = "23456789abcdefghjkmnpqrstvwxyz";
const SUFFIX_LENGTH = 6;

// Caber em `varchar(180)` com folga: título (150) + cidade (100) estouram,
// então cada parte é cortada antes de juntar.
const MAX_TITLE_PART = 80;
const MAX_CITY_PART = 40;

// Acento fora, maiúscula fora, o que não for letra ou número vira hífen.
// `NFD` separa a letra do acento e o range remove só os acentos, então
// "São" vira "sao" e não "s-o".
export function slugify(text: string, maxLength: number): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLength)
      // O corte pode cair em cima de um hífen; tirar de novo evita
      // `vendedor-centro--k3m9qp`.
      .replace(/-+$/g, "")
  );
}

export function randomSlugSuffix(): string {
  let suffix = "";

  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    suffix += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  }

  return suffix;
}

// Um título só de acentos e pontuação viraria slug vazio, e o endereço
// ficaria `/vagas/-k3m9qp`. O validador da vaga já exige 5 caracteres no
// título, mas "....." passa por ele — daí a palavra de reserva.
const FALLBACK = "vaga";

export function buildVacancySlug(title: string, city: string): string {
  const titlePart = slugify(title, MAX_TITLE_PART) || FALLBACK;
  const cityPart = slugify(city, MAX_CITY_PART);

  return [titlePart, cityPart, randomSlugSuffix()]
    .filter((part) => part.length > 0)
    .join("-");
}
