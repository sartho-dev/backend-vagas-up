// Destino no repositório: modules/advertiser/types/VerificationTypes.ts
import { CnpjEmailOwnership } from "../services/CnpjLookup";

// RN-V2: relatório de APOIO ao admin. Não decide nada e não é gravado.
export type CnpjLookupReport =
  // O CNPJ não existe na base consultada: sinal forte para o admin, por isso
  // é um resultado (200) e não um erro.
  | { found: false; document: string }
  | {
      found: true;
      document: string;
      // Razão social cadastrada na plataforma x a da Receita.
      registeredLegalName: string | null;
      receitaLegalName: string;
      // Comparação normalizada (caixa, acento e pontuação não contam).
      legalNameMatches: boolean;
      alias: string | null;
      status: { id: number; text: string; isActive: boolean };
      emailDomains: { domain: string; ownership: CnpjEmailOwnership }[];
      phones: { area: string; number: string; type: "LANDLINE" | "MOBILE" }[];
      // Responsáveis ativos x domínios de e-mail CORPORATIVOS da Receita.
      // Domínio de contabilidade ou de provedor gratuito não conta como vínculo.
      responsibles: {
        id: string;
        name: string;
        emailDomain: string;
        matchesCorporateDomain: boolean;
      }[];
      // A base de origem pode ter até 45 dias de atraso.
      sourceUpdatedAt: string;
    };
