// Destino no repositório: shared/services/HttpCnpjLookup.ts
import { z } from "zod";
import { AppError } from "../errors/AppError";
import { CnpjLookupResult, ICnpjLookup } from "./CnpjLookup";

// Resposta de fora: validamos só o que usamos e toleramos campos novos
// (o .strict() é para entrada do nosso cliente, não para API de terceiros).
const officeResponseSchema = z.looseObject({
  taxId: z.string(),
  updated: z.string(),
  alias: z.string().optional(),
  company: z.looseObject({ name: z.string() }),
  status: z.looseObject({ id: z.number(), text: z.string() }),
  phones: z
    .array(
      z.looseObject({
        type: z.enum(["LANDLINE", "MOBILE"]),
        area: z.string(),
        number: z.string(),
      }),
    )
    .default([]),
  emails: z
    .array(
      z.looseObject({
        ownership: z.enum(["ACCOUNTING", "CORPORATE", "PERSONAL"]),
        domain: z.string(),
      }),
    )
    .default([]),
});

const ACTIVE_STATUS_ID = 2;

export class HttpCnpjLookup implements ICnpjLookup {
  constructor(
    private baseUrl: string,
    private timeoutMs: number = 5000,
  ) {}

  async lookup(taxId: string): Promise<CnpjLookupResult | null> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/office/${taxId}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new AppError(
        "Serviço de consulta de CNPJ indisponível. Tente novamente em instantes",
        503,
      );
    }

    if (response.status === 404) return null;
    // O limite é de 5 consultas por minuto por IP, e o IP da VPS é de todos os admins.
    if (response.status === 429) {
      throw new AppError(
        "Limite de consultas de CNPJ atingido. Aguarde um minuto e tente novamente",
        429,
      );
    }
    if (!response.ok) {
      throw new AppError(
        "Serviço de consulta de CNPJ indisponível. Tente novamente em instantes",
        503,
      );
    }

    const parsed = officeResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new AppError(
        "Resposta inesperada do serviço de consulta de CNPJ",
        503,
      );
    }
    const office = parsed.data;

    return {
      taxId: office.taxId,
      legalName: office.company.name,
      alias: office.alias ?? null,
      statusId: office.status.id,
      statusText: office.status.text,
      isActive: office.status.id === ACTIVE_STATUS_ID,
      emailDomains: office.emails.map((e) => ({
        domain: e.domain,
        ownership: e.ownership,
      })),
      phones: office.phones.map((p) => ({
        area: p.area,
        number: p.number,
        type: p.type,
      })),
      sourceUpdatedAt: office.updated,
    };
  }
}
