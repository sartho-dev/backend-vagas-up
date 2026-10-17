// POR QUE EXISTE: o container escolhe o remetente sozinho conforme o
// ambiente. Se essa escolha errar, ou os testes passam a tentar rede, ou a
// aplicação quebra numa máquina sem SMTP no primeiro fluxo de e-mail.
import { describe, it, expect } from "vitest";
import {
  ConsoleEmailSender,
  IEmailSender,
} from "@/shared/services/EmailSender";
import { TestEmailSender } from "../utils/TestEmailSender";

describe("IEmailSender", () => {
  it("o fake de teste implementa o contrato de produção", () => {
    // Se a interface mudar e o fake não acompanhar, isto para de compilar —
    // que é exatamente o aviso que se quer, e em tempo de build.
    const sender: IEmailSender = new TestEmailSender();

    expect(typeof sender.send).toBe("function");
  });

  it("o fake guarda o que seria enviado em vez de enviar", async () => {
    const sender = new TestEmailSender();

    await sender.send({
      to: "alguem@test.local",
      subject: "Recuperação de senha",
      body: "https://app.local/recuperar?token=abc",
    });

    expect(sender.sent).toHaveLength(1);
    expect(sender.last?.to).toBe("alguem@test.local");
    expect(sender.last?.body).toContain("token=abc");
  });

  it("o reset limpa a caixa entre testes", async () => {
    const sender = new TestEmailSender();
    await sender.send({ to: "a@b.c", subject: "x", body: "y" });

    sender.reset();

    expect(sender.sent).toHaveLength(0);
  });

  it("o remetente de console não tenta rede", async () => {
    // Sem SMTP configurado o container cai aqui. Precisa resolver sem erro,
    // senão `npm run dev` numa máquina nova quebra no primeiro e-mail.
    const sender = new ConsoleEmailSender();

    await expect(
      sender.send({ to: "a@b.c", subject: "x", body: "y" }),
    ).resolves.toBeUndefined();
  });
});
