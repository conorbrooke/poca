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

export function monthBounds(year: number, month: number) {
  const periodStart = new Date(year, month - 1, 1);
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date(year, month, 0);
  periodEnd.setHours(23, 59, 59, 999);
  return { periodStart, periodEnd };
}

export function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
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

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function medianAmount(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return roundCents((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return roundCents(sorted[mid]!);
}

export function monthSurplus(
  income: number,
  spending: number,
  loanTransfers = 0,
): number {
  return roundCents(income - spending - loanTransfers);
}

export function billPayeeOnChecklist(input: {
  cadence: "WEEKLY" | "MONTHLY" | "YEARLY";
  lastMonthTotal: number;
  lastOccurrenceMonth: number | null;
  focusMonth: number;
  thisMonthSpend?: number;
}): boolean {
  if (input.cadence === "YEARLY") {
    if ((input.thisMonthSpend ?? 0) > 0) return true;
    return (
      input.lastOccurrenceMonth != null &&
      input.lastOccurrenceMonth === input.focusMonth
    );
  }
  // Monthly / weekly: Confirm is the opt-in. Stay on the list after a
  // skipped month, and in the first month the payee appears.
  return true;
}

export function isBillPayeePaid(thisMonthSpend: number, expected: number): boolean {
  if (expected > 0) return roundCents(thisMonthSpend) >= roundCents(expected);
  return thisMonthSpend > 0;
}

export function likelyPayDateThisMonth(
  lastPayDate: Date,
  year: number,
  month: number,
): string {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(lastPayDate.getDate(), lastDay);
  const date = new Date(year, month - 1, day);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function chartWindowFromFocus(year: number, month: number, now = new Date()) {
  const start = new Date(year, month - 4, 1);
  start.setHours(0, 0, 0, 0);
  const monthEnd = new Date(year, month, 0);
  monthEnd.setHours(23, 59, 59, 999);
  const end = now.getTime() < monthEnd.getTime() ? now : monthEnd;
  return { start, end };
}

export function applyLoanPayment(
  remaining: number,
  monthlyRate: number,
  payment: number,
): number {
  const interest = roundCents(Math.max(0, remaining) * monthlyRate);
  const principal = Math.min(
    Math.max(0, remaining),
    Math.max(0, roundCents(payment - interest)),
  );
  return roundCents(Math.max(0, remaining) - principal);
}

export function amortiseRemaining(
  opening: number,
  monthlyRate: number,
  payments: Array<{ amount: number }>,
): number {
  return payments.reduce(
    (remaining, payment) =>
      applyLoanPayment(remaining, monthlyRate, payment.amount),
    roundCents(opening),
  );
}

export function amortisePoints(
  opening: number,
  monthlyRate: number,
  payments: Array<{ date: string; amount: number }>,
  fromDate: string,
  toDate: string,
): Array<{ date: string; value: number }> {
  const sorted = [...payments].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const points: Array<{ date: string; value: number }> = [];
  let remaining = roundCents(opening);
  let index = 0;
  const cursor = new Date(`${fromDate}T12:00:00`);
  const end = new Date(`${toDate}T12:00:00`);
  while (cursor.getTime() <= end.getTime()) {
    const date = [
      cursor.getFullYear(),
      String(cursor.getMonth() + 1).padStart(2, "0"),
      String(cursor.getDate()).padStart(2, "0"),
    ].join("-");
    while (index < sorted.length && sorted[index]!.date <= date) {
      remaining = applyLoanPayment(
        remaining,
        monthlyRate,
        sorted[index]!.amount,
      );
      index += 1;
    }
    points.push({ date, value: remaining });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

export function depreciatedValue(
  opening: number,
  annualRate: number,
  start: Date,
  asOf: Date,
): number {
  if (annualRate <= 0 || asOf.getTime() <= start.getTime()) {
    return roundCents(opening);
  }
  const years =
    (asOf.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return roundCents(opening * (1 - annualRate) ** years);
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
