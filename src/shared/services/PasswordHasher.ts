import bcrypt from "bcrypt";
import { config } from "../config";

// RNF01: bcrypt (cost 12 mínimo) ou Argon2id. Todo hash do projeto passa por
// aqui, então o piso não pode ser driblado por uma env mal configurada.
const MIN_BCRYPT_COST = 12;

export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export class BcryptPasswordHasher implements IPasswordHasher {
  private readonly cost: number;

  constructor(cost: number = config.bcryptCost) {
    this.cost = Math.max(cost, MIN_BCRYPT_COST);
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.cost);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
