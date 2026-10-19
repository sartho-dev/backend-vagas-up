import { Repository } from "typeorm";
import { Advertiser } from "../schema/Advertiser.schema";
import { Responsible } from "../schema/Responsible.schema";
import {
  DeactivateResponsibleOutcome,
  IAdvertiserRepository,
  RegisterAdvertiserData,
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
            document: data.document,
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

  async existsByDocument(document: string): Promise<boolean> {
    return await this.repository.exists({ where: { document } });
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
}
