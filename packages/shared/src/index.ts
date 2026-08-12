import { z } from "zod";

export const createBankLinkSchema = z.object({
  institutionId: z.string().min(1),
  redirectUrl: z.string().url(),
  referenceId: z.string().min(1).optional(),
});

export type CreateBankLinkInput = z.infer<typeof createBankLinkSchema>;

export const completeBankLinkSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export type CompleteBankLinkInput = z.infer<typeof completeBankLinkSchema>;

export const SYNC_DEFAULT_DAYS = 14;
export const SYNC_MAX_DAYS = 365;

export const SYNC_RANGE_OPTIONS = [
  { label: "Last 2 weeks", days: 14 },
  { label: "Last month", days: 30 },
  { label: "Last 3 months", days: 90 },
  { label: "Last 6 months", days: 180 },
  { label: "Last year", days: 365 },
] as const;

export const syncTransactionsSchema = z.object({
  bankConnectionId: z.string().min(1),
  daysBack: z.coerce
    .number()
    .int()
    .min(1)
    .max(SYNC_MAX_DAYS)
    .default(SYNC_DEFAULT_DAYS),
});

export type SyncTransactionsInput = z.infer<typeof syncTransactionsSchema>;

export type ConnectionStats = {
  totalIncome: number;
  totalSpent: number;
  netFlow: number;
  transactionCount: number;
  avgTransactionSize: number;
  thisMonthIncome: number;
  thisMonthSpent: number;
};

export const transactionsQuerySchema = z.object({
  bankConnectionId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
});

export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;

export const listInstitutionsQuerySchema = z.object({
  country: z
    .string()
    .length(2, "Country must be a 2-letter ISO code")
    .default("IE"),
});

export type ListInstitutionsQuery = z.infer<typeof listInstitutionsQuerySchema>;

export const connectionIdParamSchema = z.object({
  id: z.string().min(1),
});

export type ConnectionIdParam = z.infer<typeof connectionIdParamSchema>;

export const dashboardQuerySchema = z.object({
  bankConnectionId: z.string().min(1).optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/** Common Irish banks — use institution list from API for exact IDs */
export const IRISH_BANK_NAMES = [
  "Allied Irish Banks",
  "Bank of Ireland",
  "Revolut",
  "Permanent TSB",
  "Ulster Bank",
] as const;

export * from "./spending.js";
