// POR QUE EXISTE: RN-C10. O link de currículo é o único campo que aponta
// para fora do site, então é o de maior risco: um link malicioso salvo aqui
// seria servido pela API a anunciantes. As três travas são https, domínio
// conhecido e nenhum arquivo armazenado.
//
// O teste ataca o validator direto, e não pela rota, porque o que interessa
// é a regra — e assim cada caso vira uma linha em vez de um round-trip HTTP.
import { describe, it, expect } from "vitest";
import { resumeUrlSchema } from "@/modules/student/validators/CreateStudentValidator";

const accepts = (value: string) => resumeUrlSchema.safeParse(value).success;

describe("RN-C10 — link de currículo", () => {
  it("aceita os domínios permitidos", () => {
    expect(accepts("https://drive.google.com/file/d/abc/view")).toBe(true);
    expect(accepts("https://docs.google.com/document/d/abc")).toBe(true);
    expect(accepts("https://www.linkedin.com/in/fulano")).toBe(true);
    expect(accepts("https://github.com/fulano")).toBe(true);
    expect(accepts("https://1drv.ms/b/abc")).toBe(true);
    expect(accepts("https://fulano.canva.com/portfolio")).toBe(true);
  });

  it("recusa http — só https", () => {
    expect(accepts("http://drive.google.com/file/d/abc")).toBe(false);
  });

  it("recusa domínio fora da lista", () => {
    expect(accepts("https://meusite.com.br/curriculo.pdf")).toBe(false);
    expect(accepts("https://pastebin.com/abc")).toBe(false);
  });

  it("não cai no truque do domínio parecido", () => {
    // O endsWith ingênuo (sem o ponto) deixaria estes dois passarem.
    expect(accepts("https://evil-github.com/payload")).toBe(false);
    expect(accepts("https://githubbcom.net/payload")).toBe(false);
  });

  it("recusa esquemas perigosos", () => {
    expect(accepts("javascript:alert(1)")).toBe(false);
    expect(accepts("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(accepts("file:///etc/passwd")).toBe(false);
  });

  it("aceita nulo — o campo é opcional", () => {
    expect(resumeUrlSchema.safeParse(null).success).toBe(true);
  });
});
