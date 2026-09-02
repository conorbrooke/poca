import { z } from "zod";
import { spendingQuerySchema } from "./spending";

export const CATEGORY_KINDS = ["EXPENSE", "INCOME", "TRANSFER"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export function isSpendingCategoryKind(kind: CategoryKind): boolean {
  return kind === "EXPENSE";
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
