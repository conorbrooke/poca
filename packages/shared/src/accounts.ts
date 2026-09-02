export type CurrencyAmount = {
  currency: string;
  amount: number;
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CACC: "Current",
  SVGS: "Savings",
  CARD: "Card",
  CASH: "Cash",
  LOAN: "Loan",
  SACC: "Settlement",
  SLRY: "Salary",
  TRAN: "Transit",
  OTHR: "Account",
};

export function accountTypeLabel(type?: string | null): string {
  if (!type) return "Account";
  return ACCOUNT_TYPE_LABELS[type.trim().toUpperCase()] ?? "Account";
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumBalancesByCurrency(
  accounts: Array<{ currentBalance: number; currency: string }>,
): CurrencyAmount[] {
  const totals = new Map<string, number>();

  for (const account of accounts) {
    const currency = (account.currency || "EUR").toUpperCase();
    totals.set(currency, roundMoney((totals.get(currency) ?? 0) + account.currentBalance));
  }

  return [...totals.entries()]
    .sort(([left], [right]) => compareCurrency(left, right))
    .map(([currency, amount]) => ({ currency, amount }));
}

function compareCurrency(left: string, right: string): number {
  if (left === "EUR") return -1;
  if (right === "EUR") return 1;
  return left.localeCompare(right);
}
