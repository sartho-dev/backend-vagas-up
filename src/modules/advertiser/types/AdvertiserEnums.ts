export enum AdvertiserType {
  COMPANY = "PJ",
  INDIVIDUAL = "PF",
}

export enum VerificationStatus {
  PENDING = "pendente",
  VERIFIED = "verificado",
  REJECTED = "recusado",
}

// RN-V2/V3: o método registra COMO o admin verificou, não o que ele viu.
// PJ: consulta pública do CNPJ + vínculo do responsável (e-mail corporativo
// OU ligação para o telefone público). PF: e-mail e telefone por código +
// videochamada — o método resume o fluxo inteiro, como a RN-V3 descreve.
export enum VerificationMethod {
  CNPJ_LOOKUP_EMAIL_DOMAIN = "cnpj_lookup_email_domain",
  CNPJ_LOOKUP_PHONE_CALL = "cnpj_lookup_phone_call",
  VIDEO_CALL = "video_call",
}

export function isCnpjMethod(method: VerificationMethod): boolean {
  return (
    method === VerificationMethod.CNPJ_LOOKUP_EMAIL_DOMAIN ||
    method === VerificationMethod.CNPJ_LOOKUP_PHONE_CALL
  );
}
