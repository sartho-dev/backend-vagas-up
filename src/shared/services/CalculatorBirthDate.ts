// RN26 / PR7: idade mínima. A constante fica em um ponto só.
export const MIN_AGE_YEARS = 16;

// RN28: pega ano/mês/dia no fuso de negócio, não em UTC.
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
// do aniversário de 16 anos.
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
