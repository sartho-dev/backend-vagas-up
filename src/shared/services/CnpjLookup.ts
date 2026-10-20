// Destino no repositório: shared/services/CnpjLookup.ts
//
// RN-V2: consulta pública de CNPJ usada como APOIO à decisão do admin.
// Ela não verifica nada sozinha e nada do que devolve é gravado.

export type CnpjEmailOwnership = "ACCOUNTING" | "CORPORATE" | "PERSONAL";

export type CnpjLookupResult = {
  taxId: string;
  // Razão social registrada na Receita (company.name).
  legalName: string;
  // Nome fantasia, quando houver.
  alias: string | null;
  // Código da situação cadastral: 1 nula, 2 ativa, 3 suspensa, 4 inapta, 8 baixada.
  statusId: number;
  statusText: string;
  isActive: boolean;
  emailDomains: { domain: string; ownership: CnpjEmailOwnership }[];
  phones: { area: string; number: string; type: "LANDLINE" | "MOBILE" }[];
  // Data da última atualização da base de origem (pode ter até 45 dias).
  sourceUpdatedAt: string;
};

export interface ICnpjLookup {
  // Devolve null quando o CNPJ não existe na base de origem.
  // Lança AppError 429 se o limite de consultas estourou e 503 se o serviço
  // está indisponível, para o admin saber que deve tentar de novo e não
  // confundir com "CNPJ inexistente".
  lookup(taxId: string): Promise<CnpjLookupResult | null>;
}

export class UnavailableCnpjLookup implements ICnpjLookup {
  async lookup(_taxId: string): Promise<CnpjLookupResult | null> {
    return null;
  }
}
