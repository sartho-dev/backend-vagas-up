// POR QUE EXISTE: a RN-A5 é a regra de senha de TODOS os perfis — está num
// só lugar justamente para candidato e admin não divergirem. O caso dos 72
// bytes é o que ninguém lembra: o bcrypt trunca silenciosamente a partir daí,
// então uma senha de 64 caracteres acentuados teria o final ignorado e duas
// senhas diferentes poderiam dar o mesmo hash.
import { describe, it, expect } from "vitest";
import { passwordSchema } from "@/shared/validators/passwordSchema";

const accepts = (value: string) => passwordSchema.safeParse(value).success;

describe("RN-A5 — regra de senha", () => {
  it("recusa com 9 caracteres", () => {
    expect(accepts("a".repeat(9))).toBe(false);
  });

  it("aceita com 10, mesmo só de minúsculas", () => {
    // A v4.9 não exige maiúscula, número nem símbolo — só comprimento.
    expect(accepts("abcdefghij")).toBe(true);
  });

  it("aceita com 64", () => {
    expect(accepts("a".repeat(64))).toBe(true);
  });

  it("recusa com 65", () => {
    expect(accepts("a".repeat(65))).toBe(false);
  });

  it("recusa 64 caracteres que passem de 72 bytes", () => {
    // "ã" ocupa 2 bytes em UTF-8: 64 deles são 128 bytes.
    const accented = "ã".repeat(64);

    expect(accented.length).toBe(64);
    expect(Buffer.byteLength(accented, "utf8")).toBeGreaterThan(72);
    expect(accepts(accented)).toBe(false);
  });

  it("aceita acentos que caibam em 72 bytes", () => {
    // 30 caracteres, 60 bytes.
    expect(accepts("ã".repeat(30))).toBe(true);
  });
});
