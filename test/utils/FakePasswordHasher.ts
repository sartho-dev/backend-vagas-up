import { createHash } from "node:crypto";
import { IPasswordHasher } from "@/shared/services/PasswordHasher";

export class FakePasswordHasher implements IPasswordHasher {
  private readonly prefix = "fake$";

  async hash(password: string): Promise<string> {
    return this.prefix + createHash("sha256").update(password).digest("hex");
  }

  async verify(password: string, hash: string): Promise<boolean> {
    if (!hash.startsWith(this.prefix)) return false;
    return (await this.hash(password)) === hash;
  }
}
