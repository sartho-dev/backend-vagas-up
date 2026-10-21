import { CnpjLookupResult, ICnpjLookup } from "@/shared/services/CnpjLookup";

// RN-V2: a consulta pública é apoio à decisão do admin. Bater na Receita a
// cada teste seria lento e não determinístico, então o fake devolve o que o
// teste programar — e registra o que foi consultado, para provar que o
// service manda o documento do anunciante certo.
export class TestCnpjLookup implements ICnpjLookup {
  readonly asked: string[] = [];
  private results = new Map<string, CnpjLookupResult | null>();

  async lookup(taxId: string): Promise<CnpjLookupResult | null> {
    this.asked.push(taxId);
    return this.results.get(taxId) ?? null;
  }

  // Sem `set`, o fake responde null — que é "CNPJ inexistente na base".
  set(taxId: string, result: Partial<CnpjLookupResult> | null): void {
    if (result === null) {
      this.results.set(taxId, null);
      return;
    }

    this.results.set(taxId, {
      taxId,
      legalName: "Padaria do Zé LTDA",
      alias: null,
      statusId: 2,
      statusText: "Ativa",
      isActive: true,
      emailDomains: [],
      phones: [],
      sourceUpdatedAt: "2026-10-01T00:00:00.000Z",
      ...result,
    });
  }

  reset(): void {
    this.asked.length = 0;
    this.results.clear();
  }
}
