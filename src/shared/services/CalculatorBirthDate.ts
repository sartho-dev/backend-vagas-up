// RN-C1 / P4: idade mínima no cadastro. A v4.9 define 14 anos (idade legal
// do jovem aprendiz, CLT art. 428). A história de usuário da seção 7 do SRS
// ainda diz 16 — contradição decidida em favor da RN-C1 (14) em 17/10/2026.
// A constante fica em um ponto só para a P4 (conferência jurídica) mudar
// isso numa linha.
export const MIN_AGE_YEARS = 14;

// Pega ano/mês/dia no fuso de negócio (America/Campo_Grande), não em UTC.
// `Intl` resolve sem dependência extra (date-fns-tz etc.).
function localDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)!.value);

  return { year: get("year"), month: get("month"), day: get("day") };
}

// Idade completa em anos, com precisão de dia, no fuso informado.
// Exportada para o teste conseguir injetar `now` e testar o dia exato
// do aniversário que atinge a idade mínima.
export function hasMinimumAge(
  birthDate: string,
  minYears: number,
  now: Date,
  timeZone: string,
): boolean {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const today = localDateParts(now, timeZone);

  let age = today.year - birthYear;
  if (
    today.month < birthMonth ||
    (today.month === birthMonth && today.day < birthDay)
  ) {
    age -= 1;
  }

  return age >= minYears;
}
