import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AccountRole } from "../types/AccountRole";
import { TokenType } from "../types/TokenType";
import { Advertiser } from "../../advertiser/schema/Advertiser.schema";

// Token de uso único para links enviados por e-mail: recuperação de senha
// (RN-A6), convite de responsável (RF22) e confirmação de troca de e-mail
// (RF03).
//
// Mesma escolha da tabela de sessões: guarda-se só o hash. Um banco vazado
// não entrega nenhum link utilizável.
@Entity("single_use_tokens")
@Index(["type", "targetEmail"])
export class SingleUseToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "type", type: "enum", enum: TokenType })
  type: TokenType;

  // Para quem o link foi enviado. É este endereço que o fluxo confirma —
  // não o e-mail atual da conta —, que é o que faz a troca de e-mail (RF03)
  // ser segura.
  @Column({ name: "target_email", type: "varchar", length: 255 })
  targetEmail: string;

  // Nulos no convite (RF22): a conta do convidado ainda não existe quando o
  // link é gerado. Nos demais tipos, apontam para a conta dona do token.
  //
  // Polimórficos pelo mesmo motivo da tabela de sessões — enquanto a decisão
  // D1 (tabela única de usuários) não sair, não há uma tabela para apontar.
  @Column({
    name: "account_type",
    type: "enum",
    enum: AccountRole,
    nullable: true,
  })
  accountType: AccountRole | null;

  @Column({ name: "account_id", type: "uuid", nullable: true })
  accountId: string | null;

  // RF22: só no convite. Quando o link é gerado, a conta do convidado ainda
  // não existe — o que existe é o anunciante a que ele vai pertencer.
  //
  // Esta coluna foi adiada na task 06 de propósito: `advertisers` não
  // existia, e um uuid solto seria FK sem restrição no banco (contra a
  // RNF06). Agora entra com a restrição junto.
  @ManyToOne(() => Advertiser, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "advertiser_id" })
  advertiser: Advertiser | null;

  @Column({ name: "advertiser_id", type: "uuid", nullable: true })
  advertiserId: string | null;

  // RNF01: SHA-256 em hexadecimal. O token em si nunca é gravado.
  @Column({ name: "token_hash", type: "char", length: 64, unique: true })
  tokenHash: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  // Marcado na MESMA transação da ação que o token autoriza. Se a ação
  // falhar, o token continua válido; se der certo, ele morre junto.
  @Column({ name: "used_at", type: "timestamptz", nullable: true })
  usedAt: Date | null;

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt: Date;
}
