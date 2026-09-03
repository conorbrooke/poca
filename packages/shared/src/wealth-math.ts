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
