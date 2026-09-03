import { z } from "zod";
import { spendingQuerySchema } from "./spending";

export const CATEGORY_KINDS = ["EXPENSE", "INCOME", "TRANSFER"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const CATEGORY_KIND_OPTIONS = [
  {
    id: "EXPENSE" as const,
    label: "Expense",
    hint: "Counts as spending",
  },
  {
    id: "INCOME" as const,
    label: "Income",
    hint: "Counts as earned",
  },
  {
    id: "TRANSFER" as const,
    label: "Transfer",
    hint: "Money moving — not spend or earnings",
  },
] as const;

export function isSpendingCategoryKind(kind: CategoryKind): boolean {
  return kind === "EXPENSE";
}

export function isIncomeCategoryKind(kind: CategoryKind): boolean {
  return kind === "INCOME";
}

export function categoryKindLabel(kind: CategoryKind): string {
  return CATEGORY_KIND_OPTIONS.find((option) => option.id === kind)?.label ?? kind;
}

export function suggestedCategoryKind(amount: number): CategoryKind {
  return amount >= 0 ? "INCOME" : "EXPENSE";
}

export function groupCategoriesByKind<T extends { kind: CategoryKind }>(
  categories: T[],
): Record<CategoryKind, T[]> {
  return {
    EXPENSE: categories.filter((category) => category.kind === "EXPENSE"),
    INCOME: categories.filter((category) => category.kind === "INCOME"),
    TRANSFER: categories.filter((category) => category.kind === "TRANSFER"),
  };
}

export const linkTransferSchema = z.object({
  outTransactionId: z.string().min(1),
  inTransactionId: z.string().min(1),
});

export type LinkTransferInput = z.infer<typeof linkTransferSchema>;

export const transfersQuerySchema = spendingQuerySchema;

export type TransfersQuery = z.infer<typeof transfersQuerySchema>;

export type TransferCounterparty = {
  transactionId: string;
  amount: number;
  currency: string;
  accountName: string;
  institutionName: string;
  bookedAt: string;
  payeeLabel: string | null;
};

export type TransferLinkSummary = {
  id: string;
  status: "SUGGESTED" | "CONFIRMED";
  amount: number;
  currency: string;
  bookedAt: string;
  out: TransferCounterparty;
  in: TransferCounterparty | null;
};

export type TransfersSummaryResponse = {
  range: string;
  periodLabel?: string;
  periodStart: string;
  periodEnd: string;
  totalTransferred: number;
  transactionCount: number;
  linkedCount: number;
  unlinkedCount: number;
  transfers: TransferLinkSummary[];
};

export type TransactionTransferInfo = {
  id: string;
  status: "SUGGESTED" | "CONFIRMED";
  direction: "out" | "in";
  counterparty: TransferCounterparty | null;
};
