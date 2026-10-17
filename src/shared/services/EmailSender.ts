import nodemailer, { Transporter } from "nodemailer";
import { config } from "../config";

export type OutgoingEmail = {
  to: string;
  subject: string;
  body: string;
};

// SRS 2.3: o envio sai por serviço externo. A interface existe para que os
// testes rodem sem rede (ver test/utils/TestEmailSender.ts) e para trocar de
// provedor sem tocar em quem envia.
export interface IEmailSender {
  send(email: OutgoingEmail): Promise<void>;
}

export class SmtpEmailSender implements IEmailSender {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      // 465 é TLS implícito; as demais portas sobem para TLS via STARTTLS.
      secure: config.mail.port === 465,
      auth: config.mail.user
        ? { user: config.mail.user, pass: config.mail.pass }
        : undefined,
    });
  }

  async send(email: OutgoingEmail): Promise<void> {
    await this.transporter.sendMail({
      from: config.mail.from,
      to: email.to,
      subject: email.subject,
      text: email.body,
    });
  }
}

// Usado quando não há SMTP configurado (desenvolvimento local): escreve o
// e-mail no log em vez de tentar enviar. Sem isso, o primeiro `npm run dev`
// numa máquina nova quebraria no fluxo de recuperação de senha.
export class ConsoleEmailSender implements IEmailSender {
  async send(email: OutgoingEmail): Promise<void> {
    console.log(
      `[email:console] para=${email.to} assunto=${email.subject}\n${email.body}`,
    );
  }
}
