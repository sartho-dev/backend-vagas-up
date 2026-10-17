// Tipos de token de uso único previstos pela v4.9.
export enum TokenType {
  // RN-A6: recuperação de senha. Vale 30 min.
  PASSWORD_RECOVERY = "recuperacao",
  // RF22: convite de responsável. Vale 72 h e a conta ainda não existe.
  INVITE = "convite",
  // RF03: confirmação do novo e-mail, enviada ao NOVO endereço.
  EMAIL_CHANGE = "troca_email",
}
