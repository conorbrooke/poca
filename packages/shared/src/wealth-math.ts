export const DIRT_RATE = 0.33;

export function savingsRate(income: number, spending: number): number {
  if (income <= 0) return 0;
  return Math.round(((income - spending) / income) * 1000) / 10;
}

export function afterDirt(grossInterest: number, rate = DIRT_RATE): number {
  return Math.round(grossInterest * (1 - rate) * 100) / 100;
}

export function monthlyFromCadence(
  amount: number,
  cadence: "WEEKLY" | "MONTHLY" | "YEARLY",
): number {
  if (cadence === "WEEKLY") return Math.round(((amount * 52) / 12) * 100) / 100;
  if (cadence === "YEARLY") return Math.round((amount / 12) * 100) / 100;
  return Math.round(amount * 100) / 100;
}

export function emergencyFundTarget(
  essentialMonthly: number,
  months = 3,
): number {
  return Math.round(essentialMonthly * months * 100) / 100;
}

export function remainingBudget(budgeted: number, spent: number): number {
  return Math.round((budgeted - spent) * 100) / 100;
}

export type DebtPayoffItem = {
  id: string;
  name: string;
  balance: number;
  interestRate: number | null;
};

export function sortAvalanche<T extends DebtPayoffItem>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const rateDiff = (right.interestRate ?? 0) - (left.interestRate ?? 0);
    if (rateDiff !== 0) return rateDiff;
    return right.balance - left.balance;
  });
}

export function sortSnowball<T extends DebtPayoffItem>(items: T[]): T[] {
  return [...items].sort((left, right) => left.balance - right.balance);
}

export function holdingMarketValue(quantity: number, price: number): number {
  return Math.round(quantity * price * 100) / 100;
}

export function holdingGain(
  quantity: number,
  averageCost: number,
  price: number,
): number {
  return Math.round((price - averageCost) * quantity * 100) / 100;
}

export function monthlyPensionInflow(input: {
  employeeContributionMonthly?: number | null;
  employerContributionMonthly?: number | null;
  stateContributionMonthly?: number | null;
  employerMatchAnnual?: number | null;
}): number {
  const fromMonthly =
    (input.employeeContributionMonthly ?? 0) +
    (input.employerContributionMonthly ?? 0) +
    (input.stateContributionMonthly ?? 0);
  if (fromMonthly > 0) return Math.round(fromMonthly * 100) / 100;
  if (input.employerMatchAnnual && input.employerMatchAnnual > 0) {
    return Math.round((input.employerMatchAnnual / 12) * 100) / 100;
  }
  return 0;
}

export function myFutureFundMonthlyFromGross(grossMonthly: number): {
  employee: number;
  employer: number;
  state: number;
  total: number;
} {
  const employee = Math.round(grossMonthly * 0.015 * 100) / 100;
  const employer = Math.round(grossMonthly * 0.015 * 100) / 100;
  const state = Math.round(grossMonthly * 0.005 * 100) / 100;
  return {
    employee,
    employer,
    state,
    total: Math.round((employee + employer + state) * 100) / 100,
  };
}
