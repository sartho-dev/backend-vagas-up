import {
  IEmailSender,
  OutgoingEmail,
} from "@/shared/services/EmailSender";

export type SentEmail = OutgoingEmail;

// Guarda em memória em vez de enviar. Os testes leem `sent` para conferir
// destinatário e corpo — é assim que o link de recuperação é capturado sem
// precisar de caixa de e-mail.
export class TestEmailSender implements IEmailSender {
  readonly sent: SentEmail[] = [];

  async send(email: OutgoingEmail): Promise<void> {
    this.sent.push(email);
  }

  get last(): SentEmail | undefined {
    return this.sent[this.sent.length - 1];
  }

  reset(): void {
    this.sent.length = 0;
  }
}
