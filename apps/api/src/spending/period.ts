export {
  resolveSpendingPeriod,
  type ResolvedSpendingPeriod,
} from "@poca/shared";

export function toDateOnly(date: Date): Date {
  return new Date(date.toISOString().slice(0, 10));
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeSearchText(
  description: string,
  merchant?: string | null,
): string {
  return `${merchant ?? ""} ${description}`.trim().toLowerCase();
}

export function derivePayeeLabel(description: string, merchant?: string | null): string {
  if (merchant?.trim()) {
    return merchant.trim().slice(0, 120);
  }

  const cleaned = description
    .replace(/^posc?\d{2}[a-z]{3}\s+/i, "")
    .replace(/^pos\d{2}[a-z]{3}\s+/i, "")
    .replace(/^atm[^\s]*\s+/i, "")
    .trim();

  return (cleaned || description).slice(0, 120);
}
