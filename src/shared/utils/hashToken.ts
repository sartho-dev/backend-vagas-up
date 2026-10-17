import { createHash } from "node:crypto";

// RNF01: tokens de sessão e de links são guardados SÓ como hash SHA-256.
//
// Hash e token não são alternativas, eles trabalham juntos: o token é o que
// o cliente apresenta, o hash é o que o banco guarda. Assim um banco vazado
// não entrega nenhuma sessão nem nenhum link utilizável.
//
// SHA-256 sem sal é adequado AQUI e não seria para senha: o token tem 256
// bits de entropia aleatória, então não há dicionário nem rainbow table que
// o alcance. Senha é diferente — por isso senha usa bcrypt.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
