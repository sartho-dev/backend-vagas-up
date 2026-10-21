import { AppError } from "../../../shared/errors/AppError";
import { ICnpjLookup } from "../../../shared/services/CnpjLookup";
import { companyNamesMatch } from "../../../shared/utils/normalizeCompanyName";
import { IAdvertiserRepository } from "../interfaces/IAdvertiserRepository";
import { IResponsibleRepository } from "../interfaces/IResponsibleRepository";
import { Advertiser } from "../schema/Advertiser.schema";
import { Responsible } from "../schema/Responsible.schema";
import {
  AdvertiserDetailForAdmin,
  ResponsibleResult,
  VerificationQueueItem,
} from "../types/AdvertiserTypes";
import {
  AdvertiserType,
  isCnpjMethod,
  VerificationMethod,
} from "../types/AdvertiserEnums";
import { CnpjLookupReport } from "@/shared/types/VerificationTypes";
import {
  // <- só o que o repositório recebe
  ListPendingVerificationOptions,
} from "../interfaces/IAdvertiserRepository";

import type { DecideVerificationInput } from "../validators/AdvertiserValidator";

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

function toResponsibleResult(r: Responsible): ResponsibleResult {
  return { id: r.id, name: r.name, email: r.email, active: r.active };
}

function toQueueItem(a: Advertiser): VerificationQueueItem {
  return {
    id: a.id,
    type: a.type,
    document: a.document,
    displayName: a.displayName,
    legalName: a.legalName,
    contactEmail: a.contactEmail,
    contactPhone: a.contactPhone,
    verificationRequestedAt: a.verificationRequestedAt!,
  };
}

function toDetail(
  a: Advertiser,
): Omit<AdvertiserDetailForAdmin, "responsibles"> {
  return {
    id: a.id,
    type: a.type,
    document: a.document,
    displayName: a.displayName,
    legalName: a.legalName,
    contactEmail: a.contactEmail,
    contactPhone: a.contactPhone,
    site: a.site,
    verification: a.verification,
    active: a.active,
    verifiedBy: a.verifiedBy,
    verifiedAt: a.verifiedAt,
    verificationMethod: a.verificationMethod,
    rejectionReason: a.rejectionReason,
    verificationRequestedAt: a.verificationRequestedAt,
  };
}

export class AdvertiserVerificationService {
  constructor(
    private advertisers: IAdvertiserRepository,
    private responsibles: IResponsibleRepository,
    private cnpj: ICnpjLookup,
  ) {}

  private async advertiserOf(responsibleId: string): Promise<string> {
    const responsible = await this.responsibles.findById(responsibleId);
    if (!responsible) {
      throw new AppError("Responsável não encontrado", 404);
    }
    return responsible.advertiserId;
  }

  // RF21
  async requestVerificationService(responsibleId: string): Promise<void> {
    const advertiserId = await this.advertiserOf(responsibleId);

    const outcome = await this.advertisers.requestVerification(advertiserId);

    if (outcome === "not_found") {
      throw new AppError("Anunciante não encontrado", 404);
    }
    if (outcome === "already_verified") {
      throw new AppError("Anunciante já está verificado", 409);
    }
    if (outcome === "already_pending") {
      throw new AppError(
        "Já existe um pedido de verificação em análise para este anunciante",
        409,
      );
    }
  }

  // RF30: fila
  async listPendingForAdminService(options: ListPendingVerificationOptions) {
    const { items, total } =
      await this.advertisers.listPendingVerification(options);

    return {
      items: items.map(toQueueItem),
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  // RF30: detalhe com os responsáveis — é o que o admin precisa para
  // conferir o vínculo (RN-V2) sem sair da tela.
  async getDetailForAdminService(
    advertiserId: string,
  ): Promise<AdvertiserDetailForAdmin> {
    const advertiser = await this.advertisers.findById(advertiserId);
    if (!advertiser) throw new AppError("Anunciante não encontrado", 404);

    const list = await this.advertisers.listResponsibles(advertiserId);

    return {
      ...toDetail(advertiser),
      responsibles: list.map(toResponsibleResult),
    };
  }

  // RN-V2: consulta pública. Nada é gravado — a decisão é do admin.
  async cnpjLookupService(advertiserId: string): Promise<CnpjLookupReport> {
    const advertiser = await this.advertisers.findById(advertiserId);
    if (!advertiser) throw new AppError("Anunciante não encontrado", 404);

    if (advertiser.type !== AdvertiserType.COMPANY) {
      throw new AppError(
        "A consulta de CNPJ só vale para anunciante pessoa jurídica",
        400,
      );
    }

    const office = await this.cnpj.lookup(advertiser.document);
    if (!office) return { found: false, document: advertiser.document };

    const corporateDomains = new Set(
      office.emailDomains
        .filter((d) => d.ownership === "CORPORATE")
        .map((d) => d.domain.toLowerCase()),
    );

    const responsibles = (
      await this.advertisers.listResponsibles(advertiser.id)
    )
      .filter((r) => r.active)
      .map((r) => {
        const emailDomain = domainOf(r.email);
        return {
          id: r.id,
          name: r.name,
          emailDomain,
          matchesCorporateDomain: corporateDomains.has(emailDomain),
        };
      });

    return {
      found: true,
      document: advertiser.document,
      registeredLegalName: advertiser.legalName,
      receitaLegalName: office.legalName,
      legalNameMatches: advertiser.legalName
        ? companyNamesMatch(advertiser.legalName, office.legalName)
        : false,
      alias: office.alias,
      status: {
        id: office.statusId,
        text: office.statusText,
        isActive: office.isActive,
      },
      emailDomains: office.emailDomains,
      phones: office.phones,
      responsibles,
      sourceUpdatedAt: office.sourceUpdatedAt,
    };
  }

  // RF30 + RNF07
  async decideService(
    adminId: string,
    advertiserId: string,
    input: DecideVerificationInput,
  ): Promise<void> {
    const advertiser = await this.advertisers.findById(advertiserId);
    if (!advertiser) throw new AppError("Anunciante não encontrado", 404);

    // O método precisa bater com o tipo — sem isso, o admin "verifica" uma
    // PJ por videochamada (que não prova CNPJ) e o registro de auditoria
    // fica sem sentido.
    if (input.decision === "verify") {
      if (
        advertiser.type === AdvertiserType.COMPANY &&
        !isCnpjMethod(input.method)
      ) {
        throw new AppError(
          "Pessoa jurídica verifica pelo CNPJ e pelo vínculo do responsável " +
            "(e-mail corporativo ou ligação)",
          400,
        );
      }
      if (
        advertiser.type === AdvertiserType.INDIVIDUAL &&
        input.method !== VerificationMethod.VIDEO_CALL
      ) {
        throw new AppError("Pessoa física verifica por videochamada", 400);
      }
    }

    const outcome = await this.advertisers.decideVerification(advertiserId, {
      decision: input.decision,
      method: input.decision === "verify" ? input.method : null,
      reason: input.decision === "reject" ? input.reason : null,
      adminId,
    });

    if (outcome === "not_found") {
      throw new AppError("Anunciante não encontrado", 404);
    }
    if (outcome === "already_verified") {
      throw new AppError("Anunciante já está verificado", 409);
    }
    if (outcome === "already_rejected") {
      throw new AppError(
        "Anunciante já foi recusado. Aguarde um novo pedido do responsável.",
        409,
      );
    }
  }
}
