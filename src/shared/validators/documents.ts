// Validação por dígito verificador de CPF e CNPJ (RF10, RF20).
//
// Conferir os dígitos não prova que o documento existe — isso é papel da
// verificação do administrador (RN-V2/V3). O que esta checagem faz é barrar
// o erro de digitação e o "11111111111" de teste antes de ocupar um
// documento único no banco.

// Sequências repetidas passam no cálculo dos dígitos, então são barradas à
// parte: 111.111.111-11 é matematicamente válido e obviamente falso.
function isRepeated(digits: string): boolean {
  return new RegExp(`^(\\d)\\1{${digits.length - 1}}$`).test(digits);
}

export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || isRepeated(cpf)) return false;

  const checkDigit = (base: string, firstWeight: number): number => {
    let weight = firstWeight;
    let sum = 0;
    for (const digit of base) {
      sum += Number(digit) * weight;
      weight -= 1;
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    checkDigit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    checkDigit(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

export function isValidCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || isRepeated(cnpj)) return false;

  // Os pesos do CNPJ não são uma sequência simples como os do CPF: vão de 5
  // a 2 e reiniciam em 9.
  const checkDigit = (base: string): number => {
    const weights =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const sum = [...base].reduce(
      (total, digit, i) => total + Number(digit) * weights[i],
      0,
    );
    const remainder = sum % 11;

    return remainder < 2 ? 0 : 11 - remainder;
  };

  return (
    checkDigit(cnpj.slice(0, 12)) === Number(cnpj[12]) &&
    checkDigit(cnpj.slice(0, 13)) === Number(cnpj[13])
  );
}
