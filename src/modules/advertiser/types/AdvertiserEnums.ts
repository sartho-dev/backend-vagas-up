// RF20: o anunciante pode ser pessoa jurídica (CNPJ) ou física (CPF). A
// v4.0 abriu para PF porque o mercado local é de pequenos negócios e
// autônomos — com limites próprios, ver RN-V3a.
export enum AdvertiserType {
  COMPANY = "PJ",
  INDIVIDUAL = "PF",
}

// RN-V1: todo anunciante nasce pendente. Recusado pode pedir de novo.
export enum VerificationStatus {
  PENDING = "pendente",
  VERIFIED = "verificado",
  REJECTED = "recusado",
}
