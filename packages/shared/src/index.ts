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

export const syncTransactionsSchema = z.object({
  bankConnectionId: z.string().min(1),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export type SyncTransactionsInput = z.infer<typeof syncTransactionsSchema>;

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
