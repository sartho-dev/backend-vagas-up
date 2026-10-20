import { IsNull, Not, Repository } from "typeorm";
import { Advertiser } from "../schema/Advertiser.schema";
import { Responsible } from "../schema/Responsible.schema";
import {
  DeactivateResponsibleOutcome,
  DecideVerificationInput,
  DecideVerificationOutcome,
  IAdvertiserRepository,
  ListPendingVerificationOptions,
  ListPendingVerificationResult,
  RegisterAdvertiserData,
  RequestVerificationOutcome,
  UpdateAdvertiserData,
} from "../interfaces/IAdvertiserRepository";
import { VerificationStatus } from "../types/AdvertiserEnums";
import { AppError } from "../../../shared/errors/AppError";

// 23505 = unique_violation. Documento e e-mail têm constraint no banco; a
// checagem prévia do service é só a resposta amigável, e esta tradução
// cobre a corrida entre duas requisições simultâneas.
function rethrowUniqueViolation(error: unknown): never {
  const detail = (error as { code?: string; detail?: string }) ?? {};

  if (detail.code === "23505") {
    if (detail.detail?.includes("document")) {
      throw new AppError("Documento já cadastrado", 409);
    }
    throw new AppError("E-mail já está em uso", 409);
  }

  throw error;
}

export class AdvertiserRepository implements IAdvertiserRepository {
  constructor(private repository: Repository<Advertiser>) {}

  async register(data: RegisterAdvertiserData) {
    try {
      return await this.repository.manager.transaction(async (tm) => {
        const advertiser = await tm.save(
          tm.create(Advertiser, {
            type: data.type,
            cnpj: data.cnpj,
            displayName: data.displayName,
            legalName: data.legalName,
            contactEmail: data.contactEmail,
            contactPhone: data.contactPhone,
            site: data.site,
            // RN-V1
            verification: VerificationStatus.PENDING,
          }),
        );

        const responsible = await tm.save(
          tm.create(Responsible, {
            advertiserId: advertiser.id,
            ...data.firstResponsible,
          }),
        );

        return { advertiser, responsible };
      });
    } catch (error) {
      rethrowUniqueViolation(error);
    }
  }

  async findById(id: string): Promise<Advertiser | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async existsByDocument(cnpj: string): Promise<boolean> {
    return await this.repository.exists({ where: { cnpj } });
  }

  async update(
    id: string,
    data: UpdateAdvertiserData,
  ): Promise<Advertiser | null> {
    const result = await this.repository.update({ id }, data);
    if (result.affected === 0) return null;

    return await this.findById(id);
  }

  async resetVerification(id: string): Promise<void> {
    await this.repository.update(
      { id },
      {
        verification: VerificationStatus.PENDING,
        verifiedAt: null,
        verifiedBy: null,
        verificationMethod: null,
        rejectionReason: null,
        // A mudança de nome É o gatilho: a re-verificação começa agora.
        verificationRequestedAt: new Date(),
      },
    );
  }

  async listResponsibles(advertiserId: string): Promise<Responsible[]> {
    return await this.repository.manager.find(Responsible, {
      where: { advertiserId },
      order: { createdAt: "ASC" },
    });
  }

  async addResponsible(
    advertiserId: string,
    data: { name: string; email: string; passwordHash: string },
  ): Promise<Responsible> {
    try {
      return await this.repository.manager.save(
        this.repository.manager.create(Responsible, { advertiserId, ...data }),
      );
    } catch (error) {
      rethrowUniqueViolation(error);
    }
  }

  // RN-VG8, com a mesma defesa do "último admin ativo" (RF34): travar as
  // linhas ativas em ordem fixa faz duas desativações simultâneas entrarem
  // em fila, e a segunda enxerga o conjunto já reduzido.
  async deactivateResponsible(
    id: string,
    advertiserId: string,
  ): Promise<DeactivateResponsibleOutcome> {
    return await this.repository.manager.transaction(async (tm) => {
      const activeOnes = await tm.find(Responsible, {
        select: { id: true },
        where: { advertiserId, active: true },
        order: { id: "ASC" },
        lock: { mode: "pessimistic_write" },
      });

      // Lido DEPOIS do lock: é o estado atual, não um anterior.
      const target = await tm.findOne(Responsible, {
        select: { id: true, active: true },
        where: { id, advertiserId },
      });

      if (!target) return "not_found";
      if (!target.active) return "already_inactive";
      if (activeOnes.length <= 1) return "last_active";

      await tm.update(Responsible, { id }, { active: false });

      return "deactivated";
    });
  }

  async requestVerification(id: string): Promise<RequestVerificationOutcome> {
    return await this.repository.manager.transaction(async (tm) => {
      // Lock porque dois responsáveis do mesmo anunciante podem clicar
      // "solicitar" ao mesmo tempo — sem lock, os dois passariam da checagem
      // e a fila ganharia uma entrada duplicada.
      const current = await tm.findOne(Advertiser, {
        where: { id },
        lock: { mode: "pessimistic_write" },
      });

      if (!current) return "not_found";

      if (current.verification === VerificationStatus.VERIFIED) {
        return "already_verified";
      }

      if (
        current.verification === VerificationStatus.PENDING &&
        current.verificationRequestedAt !== null
      ) {
        return "already_pending";
      }

      // Recusado ou pendente sem pedido: entra (ou volta) para a fila,
      // limpando qualquer resquício da decisão anterior.
      await tm.update(
        Advertiser,
        { id },
        {
          verification: VerificationStatus.PENDING,
          verificationRequestedAt: new Date(),
          verifiedAt: null,
          verifiedBy: null,
          verificationMethod: null,
          rejectionReason: null,
        },
      );

      return "requested";
    });
  }

  async decideVerification(
    id: string,
    input: DecideVerificationInput,
  ): Promise<DecideVerificationOutcome> {
    return await this.repository.manager.transaction(async (tm) => {
      const current = await tm.findOne(Advertiser, {
        where: { id },
        lock: { mode: "pessimistic_write" },
      });

      if (!current) return "not_found";

      // Segundo admin que clica perde: não sobrescreve a decisão do primeiro.
      if (current.verification === VerificationStatus.VERIFIED) {
        return "already_verified";
      }
      if (current.verification === VerificationStatus.REJECTED) {
        return "already_rejected";
      }

      if (input.decision === "verify") {
        await tm.update(
          Advertiser,
          { id },
          {
            verification: VerificationStatus.VERIFIED,
            verifiedBy: input.adminId,
            verifiedAt: new Date(),
            verificationMethod: input.method,
            rejectionReason: null,
          },
        );
      } else {
        await tm.update(
          Advertiser,
          { id },
          {
            verification: VerificationStatus.REJECTED,
            verifiedBy: input.adminId,
            verifiedAt: new Date(),
            verificationMethod: null,
            rejectionReason: input.reason,
          },
        );
      }

      return "decided";
    });
  }

  async listPendingVerification(
    options: ListPendingVerificationOptions,
  ): Promise<ListPendingVerificationResult> {
    const [items, total] = await this.repository.findAndCount({
      // verificationRequestedAt preenchido é o que distingue "pendente que
      // pediu verificação" de "pendente recém-cadastrado". Sem esse filtro,
      // a fila do admin encheria com anunciantes que nem pediram nada.
      where: {
        verification: VerificationStatus.PENDING,
        verificationRequestedAt: Not(IsNull()),
      },
      order: { verificationRequestedAt: "ASC" }, // FIFO
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });

    return { items, total };
  }
}
