import type { SpendingRangeId } from "@poca/shared";
import { SPENDING_RANGES } from "@poca/shared";

export function resolveSpendingPeriod(range: SpendingRangeId): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodEnd = new Date();
  periodEnd.setHours(23, 59, 59, 999);

  if (range === "all") {
    return {
      periodStart: new Date("2000-01-01T00:00:00.000Z"),
      periodEnd,
    };
  }

  const config = SPENDING_RANGES.find((item) => item.id === range);
  const days = "days" in config! ? config.days : 30;

  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - (days - 1));
  periodStart.setHours(0, 0, 0, 0);

  if (range === "week") {
    const day = periodStart.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    periodStart.setDate(periodStart.getDate() + mondayOffset);
  }

  if (range === "month") {
    periodStart.setDate(1);
  }

  return { periodStart, periodEnd };
}

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
