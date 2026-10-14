// RN32 / RNF03: outside the student's own profile the CPF must never leave
// the API in full. Only the middle digits stay visible, which is enough for
// an administrator to tell two records apart.
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
