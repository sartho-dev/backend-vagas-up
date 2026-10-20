// Destino no repositório: shared/utils/normalizeCompanyName.ts

// RN-V2 pede razão social "igual". Maiúsculas, acentos e pontuação não
// devem fazer o admin ver diferença onde não há. Sufixos como "LTDA" ou "ME"
// NÃO são removidos de propósito: sumir com eles esconderia diferença real.
export function normalizeCompanyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function companyNamesMatch(a: string, b: string): boolean {
  return normalizeCompanyName(a) === normalizeCompanyName(b);
}
