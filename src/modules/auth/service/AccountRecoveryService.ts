import { AppError } from "../../../shared/errors/AppError";
import { EmailRegistry } from "../../../shared/services/EmailRegistry";
import { IEmailSender } from "../../../shared/services/EmailSender";
import { IPasswordHasher } from "../../../shared/services/PasswordHasher";
import { config } from "../../../shared/config";
import { IAuthAccountProvider } from "../interfaces/IAuthAccountProvider";
import { ISessionRevoker } from "../interfaces/ISessionRevoker";
import { SingleUseTokenService } from "./SingleUseTokenService";
import { AccountRole } from "../types/AccountRole";
import { TokenType } from "../types/TokenType";

// RN-A6: inválido, expirado e já usado são indistinguíveis.
const INVALID_LINK = "Link inválido ou expirado";

export class AccountRecoveryService {
  private providersByRole: Map<AccountRole, IAuthAccountProvider>;

  constructor(
    private providers: IAuthAccountProvider[],
    private tokens: SingleUseTokenService,
    private emails: EmailRegistry,
    private mailer: IEmailSender,
    private hasher: IPasswordHasher,
    private sessions: ISessionRevoker,
  ) {
    this.providersByRole = new Map(providers.map((p) => [p.role, p]));
  }

  private async findAccount(email: string) {
    for (const provider of this.providers) {
      const account = await provider.findForLogin(email);
      if (account) return { provider, id: account.id };
    }
    return null;
  }

  // ---- RF01 / RN-A6: recuperação de senha --------------------------------

  // A resposta é SEMPRE a mesma, exista ou não o e-mail. Quem chama não
  // recebe nada que distinga os dois casos.
  async requestPasswordRecovery(email: string): Promise<void> {
    const found = await this.findAccount(email);

    // Conta inexistente ou desativada: nada acontece, e quem pediu não
    // descobre qual dos dois foi.
    if (!found) return;

    const token = await this.tokens.issue({
      type: TokenType.PASSWORD_RECOVERY,
      targetEmail: email,
      accountType: found.provider.role,
      accountId: found.id,
    });

    const link = `${config.appBaseUrl}/recuperar-senha?token=${token}`;

    await this.mailer.send({
      to: email,
      subject: "Recuperação de senha",
      body:
        `Você pediu para redefinir sua senha.\n\n${link}\n\n` +
        `O link vale ${config.recoveryTokenTtlMs / 60_000} minutos e só pode ` +
        `ser usado uma vez. Se não foi você, ignore este e-mail.`,
    });
  }

  async confirmPasswordRecovery(
    rawToken: string,
    newPassword: string,
  ): Promise<void> {
    // O hash é calculado ANTES de abrir a transação: bcrypt com custo 12 leva
    // centenas de milissegundos, e segurar a linha travada durante isso
    // alongaria o bloqueio sem necessidade.
    const passwordHash = await this.hasher.hash(newPassword);

    const result = await this.tokens.consume(
      rawToken,
      TokenType.PASSWORD_RECOVERY,
      async (token) => {
        if (!token.accountType || !token.accountId) return null;

        const provider = this.providersByRole.get(token.accountType);
        if (!provider) return null;

        await provider.updatePassword(token.accountId, passwordHash);

        return { role: token.accountType, id: token.accountId };
      },
    );

    if (!result) {
      throw new AppError(INVALID_LINK, 400);
    }

    // RN-A3: trocar a senha encerra todas as sessões da conta. Fica FORA da
    // transação do token de propósito — se a revogação falhar, a senha nova
    // já vale, e insistir aqui reabriria o link.
    await this.sessions.revokeAllSessions(result.role, result.id);
  }

  // ---- RF03: troca de e-mail ---------------------------------------------

  async requestEmailChange(
    role: AccountRole,
    accountId: string,
    newEmail: string,
  ): Promise<void> {
    // Resposta amigável antecipada. A checagem que vale é a da confirmação.
    if (await this.emails.isTakenByOther(newEmail, { role, id: accountId })) {
      throw new AppError("E-mail já está em uso", 409);
    }

    const token = await this.tokens.issue({
      type: TokenType.EMAIL_CHANGE,
      targetEmail: newEmail,
      accountType: role,
      accountId,
    });

    const link = `${config.appBaseUrl}/confirmar-email?token=${token}`;

    // Enviado ao endereço NOVO, nunca ao atual: é isso que prova que a pessoa
    // controla a caixa para a qual a conta vai passar.
    await this.mailer.send({
      to: newEmail,
      subject: "Confirme seu novo e-mail",
      body:
        `Confirme este endereço para concluir a troca de e-mail.\n\n${link}\n\n` +
        `O link vale ${config.recoveryTokenTtlMs / 60_000} minutos e só pode ` +
        `ser usado uma vez.`,
    });
  }

  async confirmEmailChange(rawToken: string): Promise<void> {
    const result = await this.tokens.consume(
      rawToken,
      TokenType.EMAIL_CHANGE,
      async (token) => {
        if (!token.accountType || !token.accountId) return null;

        const provider = this.providersByRole.get(token.accountType);
        if (!provider) return null;

        // RN-A7 conferida AQUI, e não só no pedido: entre pedir e confirmar,
        // outra conta pode ter registrado este endereço. Confiar na checagem
        // do pedido deixaria dois donos para o mesmo e-mail.
        const taken = await this.emails.isTakenByOther(token.targetEmail, {
          role: token.accountType,
          id: token.accountId,
        });

        if (taken) {
          throw new AppError("E-mail já está em uso", 409);
        }

        await provider.updateEmail(token.accountId, token.targetEmail);

        return { role: token.accountType, id: token.accountId };
      },
    );

    if (!result) {
      throw new AppError(INVALID_LINK, 400);
    }

    // Trocar o e-mail é mudança de credencial de acesso: encerra as sessões
    // pelo mesmo motivo da troca de senha (RN-A3).
    await this.sessions.revokeAllSessions(result.role, result.id);
  }
}
