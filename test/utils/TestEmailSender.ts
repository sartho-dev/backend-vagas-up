export type SentEmail = {
  to: string;
  subject: string;
  body: string;
};

export class TestEmailSender {
  readonly sent: SentEmail[] = [];

  async send(email: SentEmail): Promise<void> {
    this.sent.push(email);
  }

  reset(): void {
    this.sent.length = 0;
  }
}
