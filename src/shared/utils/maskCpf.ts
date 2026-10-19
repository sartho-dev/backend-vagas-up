// RNF03 / Anexo A: o CPF nunca pode chegar a um ANUNCIANTE. O candidato vê o
// próprio e o administrador vê todos (Anexo A), então esta máscara não é
// usada no módulo admin — ela existe para o banco de talentos e as listas de
// candidatura do anunciante (tasks 17 e 18). Só os dígitos do meio aparecem,
// o bastante para distinguir dois registros.
//
//   "39053344705"  ->  "•••.533.447-••"
export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");

  if (digits.length !== 11) {
    // Never fall back to returning the raw value: an unexpected format must
    // not become a leak.
    return "•••.•••.•••-••";
  }

  return `•••.${digits.slice(3, 6)}.${digits.slice(6, 9)}-••`;
}
