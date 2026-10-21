import { z } from "zod";
import { SettingKey } from "../types/PricingEnums";
import { VacancyType } from "../../../shared/types/VacancyType";

// Dinheiro em reais, com até dois decimais.
//
// Zero é válido: a P9 pergunta justamente se o lançamento abre com preço R$ 0
// por alguns meses, e a RF39 não impõe mínimo. O teto de 999.999,99 é o que
// a coluna `numeric(10,2)` aceita — barrar aqui dá 400 com mensagem em vez
// de um erro do banco.
export const vacancyPriceValueSchema = z
  .number({ error: "Valor é obrigatório" })
  .nonnegative("O valor não pode ser negativo")
  .max(999999.99, "O valor é alto demais")
  .multipleOf(0.01, "O valor tem no máximo duas casas decimais");

export const updateVacancyPriceSchema = z
  .object({ value: vacancyPriceValueSchema })
  .strict();

export const vacancyTypeParamSchema = z.object({
  type: z.enum(VacancyType, { error: "Tipo de vaga inválido" }),
});

export const settingKeyParamSchema = z.object({
  key: z.enum(SettingKey, { error: "Chave de configuração inválida" }),
});

// O valor de cada chave tem regra própria. Uma tabela chave-valor com
// validação genérica aceitaria `javascript:` no link que o site mostra aos
// anunciantes — a mesma armadilha que o campo `site` do anunciante evita.
const settingValueSchemas: Record<SettingKey, z.ZodType<string>> = {
  [SettingKey.ADVERTISER_COMMUNITY_URL]: z
    .string()
    .trim()
    .max(255, "O link deve ter no máximo 255 caracteres")
    .refine(
      (v) => v.startsWith("https://"),
      "O link deve começar com https://",
    ),
  [SettingKey.SPONSORSHIP_CONTACT]: z
    .string()
    .trim()
    .min(1, "Informe o contato")
    .max(255, "O contato deve ter no máximo 255 caracteres"),
  // A chave PIX é texto livre de propósito: pode ser CPF, CNPJ, e-mail,
  // telefone ou chave aleatória, e validar cada formato aqui só criaria uma
  // forma de recusar uma chave válida. O que importa é não estar vazia — a
  // tela de pagamento (RF28) mostra isto ao anunciante para ele transferir
  // dinheiro, e espaço em branco ali seria pior que chave não configurada.
  [SettingKey.PIX_KEY]: z
    .string()
    .trim()
    .min(1, "Informe a chave PIX")
    .max(140, "A chave PIX deve ter no máximo 140 caracteres"),
};

// `null` apaga a configuração (volta a não configurada). String vazia não é
// aceita: seria "configurado como nada", que a tela não sabe exibir.
export function updateSettingSchemaFor(key: SettingKey) {
  return z.object({ value: settingValueSchemas[key].nullable() }).strict();
}

// Só para o Swagger: o corpo real é validado pelo schema da chave.
export const updateSettingSchema = z
  .object({
    value: z
      .string()
      .max(255)
      .nullable()
      .describe("Valor da configuração; null apaga"),
  })
  .strict();

export type UpdateVacancyPriceInput = z.infer<typeof updateVacancyPriceSchema>;
export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
