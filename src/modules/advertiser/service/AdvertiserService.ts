import { AppError } from "../../../shared/errors/AppError";
import { EmailRegistry } from "../../../shared/services/EmailRegistry";
import { IEmailSender } from "../../../shared/services/EmailSender";
import { IPasswordHasher } from "../../../shared/services/PasswordHasher";
import { config } from "../../../shared/config";
import { AccountRole } from "../../auth/types/AccountRole";
import { TokenType } from "../../auth/types/TokenType";
import { SingleUseTokenService } from "../../auth/service/SingleUseTokenService";
import { IAdvertiserRepository } from "../interfaces/IAdvertiserRepository";
import { IResponsibleRepository } from "../interfaces/IResponsibleRepository";
import { Advertiser } from "../schema/Advertiser.schema";
import { Responsible } from "../schema/Responsible.schema";
import { AdvertiserResult, ResponsibleResult } from "../types/AdvertiserTypes";
import { VerificationStatus } from "../types/AdvertiserEnums";
import {
  AcceptInviteInput,
  RegisterAdvertiserInput,
  UpdateAdvertiserInput,
} from "../validators/AdvertiserValidator";

function toAdvertiserResult(advertiser: Advertiser): AdvertiserResult {
  return {
    id: advertiser.id,
    type: advertiser.type,
    cnpj: advertiser.cnpj,
    displayName: advertiser.displayName,
    legalName: advertiser.legalName,
    contactEmail: advertiser.contactEmail,
    contactPhone: advertiser.contactPhone,
    site: advertiser.site,
    verification: advertiser.verification,
    active: advertiser.active,
  };
}

function toResponsibleResult(responsible: Responsible): ResponsibleResult {
  return {
    id: responsible.id,
    name: responsible.name,
    email: responsible.email,
    active: responsible.active,
  };
}

const INVALID_INVITE = "Convite inválido ou expirado";

export class AdvertiserService {
  constructor(
    private repository: IAdvertiserRepository,
    private emails: EmailRegistry,
    private hasher: IPasswordHasher,
    private tokens: SingleUseTokenService,
    private mailer: IEmailSender,
    private responsibles: IResponsibleRepository,
  ) {}

  // A sessão identifica o RESPONSÁVEL; o anunciante vem do vínculo dele.
  // Resolver aqui, e não no controller, garante que toda rota /me opere
  // sobre o anunciante certo sem depender de quem chamou passar o id.
  private async advertiserOf(responsibleId: string): Promise<string> {
    const responsible = await this.responsibles.findById(responsibleId);

    if (!responsible) {
      throw new AppError("Responsável não encontrado", 404);
    }

    return responsible.advertiserId;
  }

  async getOwnService(responsibleId: string): Promise<AdvertiserResult> {
    return await this.getService(await this.advertiserOf(responsibleId));
  }

  async updateOwnService(
    responsibleId: string,
    data: UpdateAdvertiserInput,
  ): Promise<AdvertiserResult> {
    return await this.updateService(
      await this.advertiserOf(responsibleId),
      data,
    );
  }

  async listOwnResponsiblesService(
    responsibleId: string,
  ): Promise<ResponsibleResult[]> {
    return await this.listResponsiblesService(
      await this.advertiserOf(responsibleId),
    );
  }

  async inviteOwnResponsibleService(
    responsibleId: string,
    email: string,
  ): Promise<void> {
    await this.inviteResponsibleService(
      await this.advertiserOf(responsibleId),
      email,
    );
  }

  async deactivateOwnResponsibleService(
    responsibleId: string,
    targetId: string,
  ): Promise<void> {
    await this.deactivateResponsibleService(
      await this.advertiserOf(responsibleId),
      responsibleId,
      targetId,
    );
  }

  // RF20
  async registerService(
    data: RegisterAdvertiserInput,
  ): Promise<{ advertiser: AdvertiserResult; responsible: ResponsibleResult }> {
    if (await this.repository.existsByDocument(data.cnpj)) {
      throw new AppError("Documento já cadastrado", 409);
    }

    // RN-A7: o e-mail do responsável tem de ser único entre TODOS os
    // perfis, não só entre responsáveis.
    if (await this.emails.isTaken(data.firstResponsible.email)) {
      throw new AppError("E-mail já está em uso", 409);
    }

    const passwordHash = await this.hasher.hash(data.firstResponsible.password);

    const { advertiser, responsible } = await this.repository.register({
      type: data.type,
      cnpj: data.cnpj,
      displayName: data.displayName,
      legalName: data.legalName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      site: data.site,
      firstResponsible: {
        name: data.firstResponsible.name,
        email: data.firstResponsible.email,
        passwordHash,
      },
    });

    return {
      advertiser: toAdvertiserResult(advertiser),
      responsible: toResponsibleResult(responsible),
    };
  }

  async getService(advertiserId: string): Promise<AdvertiserResult> {
    const advertiser = await this.repository.findById(advertiserId);

    if (!advertiser) throw new AppError("Anunciante não encontrado", 404);

    return toAdvertiserResult(advertiser);
  }

  // RF23
  async updateService(
    advertiserId: string,
    data: UpdateAdvertiserInput,
  ): Promise<AdvertiserResult> {
    const current = await this.repository.findById(advertiserId);
    if (!current) throw new AppError("Anunciante não encontrado", 404);

    const updated = await this.repository.update(advertiserId, data);
    if (!updated) throw new AppError("Anunciante não encontrado", 404);

    // RF23: o selo foi concedido àquele nome. Se o nome muda, a verificação
    // precisa ser refeita — senão bastaria cadastrar como padaria, ser
    // verificado e virar financeira.
    const nameChanged =
      (data.displayName !== undefined &&
        data.displayName !== current.displayName) ||
      (data.legalName !== undefined && data.legalName !== current.legalName);

    if (nameChanged && current.verification === VerificationStatus.VERIFIED) {
      await this.repository.resetVerification(advertiserId);

      return await this.getService(advertiserId);
    }

    return toAdvertiserResult(updated);
  }

  async listResponsiblesService(
    advertiserId: string,
  ): Promise<ResponsibleResult[]> {
    const list = await this.repository.listResponsibles(advertiserId);

    return list.map(toResponsibleResult);
  }

  // RF22: convite por e-mail, link de 72 h, o convidado define a senha.
  async inviteResponsibleService(
    advertiserId: string,
    email: string,
  ): Promise<void> {
    if (await this.emails.isTaken(email)) {
      throw new AppError("E-mail já está em uso", 409);
    }

    const advertiser = await this.repository.findById(advertiserId);
    if (!advertiser) throw new AppError("Anunciante não encontrado", 404);

    // Sem accountType/accountId: a conta do convidado ainda não existe. O
    // vínculo que importa é com o anunciante.
    const token = await this.tokens.issue({
      type: TokenType.INVITE,
      targetEmail: email,
      advertiserId,
    });

    const link = `${config.appBaseUrl}/aceitar-convite?token=${token}`;

    await this.mailer.send({
      to: email,
      subject: `Convite para gerenciar ${advertiser.displayName}`,
      body:
        `Você foi convidado a gerenciar as vagas de ${advertiser.displayName}.\n\n` +
        `${link}\n\n` +
        `O link vale ${config.inviteTokenTtlMs / 3_600_000} horas e só pode ` +
        `ser usado uma vez.`,
    });
  }

  async acceptInviteService(
    data: AcceptInviteInput,
  ): Promise<ResponsibleResult> {
    const passwordHash = await this.hasher.hash(data.password);

    const created = await this.tokens.consume(
      data.token,
      TokenType.INVITE,
      async (token) => {
        if (!token.advertiserId) return null;

        // RN-A7 conferida AQUI também: entre o convite e o aceite, alguém
        // pode ter cadastrado esse e-mail.
        if (await this.emails.isTaken(token.targetEmail)) {
          throw new AppError("E-mail já está em uso", 409);
        }

        return await this.repository.addResponsible(token.advertiserId, {
          name: data.name,
          email: token.targetEmail,
          passwordHash,
        });
      },
    );

    if (!created) throw new AppError(INVALID_INVITE, 400);

    return toResponsibleResult(created);
  }

  // RN-VG8
  async deactivateResponsibleService(
    advertiserId: string,
    actorId: string,
    targetId: string,
  ): Promise<void> {
    if (actorId === targetId) {
      throw new AppError("Você não pode desativar a própria conta", 409);
    }

    const outcome = await this.repository.deactivateResponsible(
      targetId,
      advertiserId,
    );

    if (outcome === "not_found") {
      throw new AppError("Responsável não encontrado", 404);
    }
    if (outcome === "already_inactive") {
      throw new AppError("Responsável já está inativo", 409);
    }
    if (outcome === "last_active") {
      throw new AppError(
        "O anunciante precisa de ao menos um responsável ativo. " +
          "Para encerrar, desative o anunciante.",
        409,
      );
    }
  }
}
