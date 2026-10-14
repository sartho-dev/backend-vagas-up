export const MIN_AGE_YEARS = 18;

export class CalculatorBirthDate {
  static calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  static isValidAge(birthDate: Date, minAge: number = 0): boolean {
    const age = this.calculateAge(birthDate);
    return age >= minAge;
  }
}

export function hasMinimumAge(
  birthDateStr: string,
  minAge: number,
  referenceDate: Date = new Date(),
  _timezone?: string,
): boolean {
  const birthDate = new Date(`${birthDateStr}T00:00:00Z`);
  return CalculatorBirthDate.isValidAge(birthDate, minAge);
}
