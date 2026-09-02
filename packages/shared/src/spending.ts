import { z } from "zod";
import type { CategoryKind, TransactionTransferInfo } from "./transfers";

export type { CategoryKind, TransactionTransferInfo } from "./transfers";

export const SPENDING_RANGES = [
  { id: "week", label: "This week", days: 7 },
  { id: "month", label: "This month", days: 30 },
  { id: "quarter", label: "Last 3 months", days: 90 },
  { id: "6months", label: "Last 6 months", days: 180 },
  { id: "year", label: "Last year", days: 365 },
  { id: "all", label: "All time" },
] as const;

export type SpendingRangeId = (typeof SPENDING_RANGES)[number]["id"];

const rangeEnum = z.enum(["week", "month", "quarter", "6months", "year", "all"]);

function parseTagIds(value: unknown): string[] | undefined {
  if (value == null || value === "") return undefined;
  const parts = Array.isArray(value)
    ? value.map(String)
    : String(value).split(",");
  const ids = parts.map((item) => item.trim()).filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

export const spendingQuerySchema = z.object({
  range: rangeEnum.default("month"),
  bankConnectionId: z.string().min(1).optional(),
  tagIds: z.preprocess(parseTagIds, z.array(z.string().min(1)).optional()),
  flow: z.enum(["out", "in"]).default("out"),
});

export type SpendingQuery = z.infer<typeof spendingQuerySchema>;

export const categoryIdParamSchema = z.object({
  id: z.string().min(1),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(32).optional(),
  kind: z.enum(["EXPENSE", "INCOME", "TRANSFER"]).default("EXPENSE"),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(64).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(32).nullable().optional(),
  kind: z.enum(["EXPENSE", "INCOME", "TRANSFER"]).optional(),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const recategorizeTransactionSchema = z.object({
  categoryId: z.string().min(1).optional(),
  payeeLabel: z.string().min(1).max(120),
  createRule: z.boolean().default(false),
  applyToSimilar: z.boolean().default(false),
  tagIds: z.array(z.string().min(1)).optional(),
});

export type RecategorizeTransactionInput = z.infer<
  typeof recategorizeTransactionSchema
>;

export const bulkEditItemSchema = z.object({
  kind: z.enum(["transaction", "split"]),
  id: z.string().min(1),
});

export const bulkEditTransactionsSchema = z
  .object({
    items: z.array(bulkEditItemSchema).min(1).max(100),
    categoryId: z.string().min(1).optional(),
    tagIds: z.array(z.string().min(1)).optional(),
    tagMode: z.enum(["set", "add"]).default("set"),
  })
  .refine(
    (value) => value.categoryId !== undefined || value.tagIds !== undefined,
    "Provide a category and/or tags to update",
  );

export type BulkEditTransactionsInput = z.infer<
  typeof bulkEditTransactionsSchema
>;

export const spendingTransactionsQuerySchema = z.object({
  range: rangeEnum.default("month"),
  bankConnectionId: z.string().min(1).optional(),
  payeeLabel: z.string().min(1).optional(),
  tagIds: z.preprocess(parseTagIds, z.array(z.string().min(1)).optional()),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
  flow: z.enum(["out", "in"]).default("out"),
});

export type SpendingTransactionsQuery = z.infer<
  typeof spendingTransactionsQuerySchema
>;

export const createTagSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(32).optional(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(32).nullable().optional(),
});

export type UpdateTagInput = z.infer<typeof updateTagSchema>;

export const splitLineSchema = z.object({
  amount: z.number().refine((value) => value !== 0, "Amount cannot be zero"),
  categoryId: z.string().min(1),
  payeeLabel: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
  tagIds: z.array(z.string().min(1)).default([]),
});

export const replaceSplitsSchema = z.object({
  splits: z.array(splitLineSchema).min(2),
});

export type ReplaceSplitsInput = z.infer<typeof replaceSplitsSchema>;

export const unsplitTransactionSchema = z.object({
  categoryId: z.string().min(1),
  payeeLabel: z.string().min(1).max(120),
  tagIds: z.array(z.string().min(1)).default([]),
});

export type UnsplitTransactionInput = z.infer<typeof unsplitTransactionSchema>;

export const updateSplitSchema = z.object({
  categoryId: z.string().min(1).optional(),
  payeeLabel: z.string().min(1).max(120).optional(),
  description: z.string().max(240).nullable().optional(),
  tagIds: z.array(z.string().min(1)).optional(),
});

export type UpdateSplitInput = z.infer<typeof updateSplitSchema>;

export type SpendingCategorySummary = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isSystem: boolean;
  kind: CategoryKind;
  totalSpent: number;
  transactionCount: number;
  share: number;
};

export type SpendingPayeeSummary = {
  payeeLabel: string;
  totalSpent: number;
  transactionCount: number;
  share: number;
};

export type TagOption = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
};

export type ReceiptSummary = {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
};

export type SplitLineSummary = {
  id: string;
  amount: number;
  amountEur: number;
  categoryId: string;
  categoryName: string | null;
  payeeLabel: string;
  description: string | null;
  tags: TagOption[];
};

export type SpendingTransaction = {
  kind: "transaction" | "split";
  id: string;
  transactionId: string;
  splitId: string | null;
  amount: number;
  amountEur: number;
  currency: string;
  description: string;
  merchant: string | null;
  payeeLabel: string | null;
  bookedAt: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryKind: CategoryKind | null;
  institutionName: string;
  accountName: string;
  externalId: string | null;
  isSplit: boolean;
  splitOutOfBalance: boolean;
  tags: TagOption[];
  receiptCount: number;
  transfer: TransactionTransferInfo | null;
};

export type TransactionDetail = SpendingTransaction & {
  receipts: ReceiptSummary[];
  splits: SplitLineSummary[];
};

export type SpendingSummaryResponse = {
  range: SpendingRangeId;
  periodStart: string;
  periodEnd: string;
  flow: "out" | "in";
  totalSpent: number;
  totalTransferred: number;
  transferTransactionCount: number;
  transactionCount: number;
  categories: SpendingCategorySummary[];
  transfersCategory: SpendingCategorySummary | null;
  reviewCategories: SpendingCategorySummary[];
  cached: boolean;
};

export type CategoryDetailResponse = {
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    isSystem: boolean;
    kind: CategoryKind;
  };
  range: SpendingRangeId;
  periodStart: string;
  periodEnd: string;
  totalSpent: number;
  transactionCount: number;
  payees: SpendingPayeeSummary[];
  cached: boolean;
};

export type TagSummaryResponse = {
  tag: TagOption;
  range: SpendingRangeId;
  periodStart: string;
  periodEnd: string;
  totalSpent: number;
  transactionCount: number;
  categories: SpendingCategorySummary[];
};

export const DEFAULT_CATEGORY_DEFINITIONS = [
  { name: "Restaurants", color: "#f97316", icon: "🍽️", kind: "EXPENSE" as const },
  { name: "Groceries", color: "#22c55e", icon: "🛒", kind: "EXPENSE" as const },
  { name: "Fuel", color: "#64748b", icon: "⛽", kind: "EXPENSE" as const },
  { name: "Transport", color: "#3b82f6", icon: "🚌", kind: "EXPENSE" as const },
  { name: "Travel", color: "#0ea5e9", icon: "✈️", kind: "EXPENSE" as const },
  { name: "Entertainment", color: "#ec4899", icon: "🎬", kind: "EXPENSE" as const },
  { name: "Shopping", color: "#8b5cf6", icon: "🛍️", kind: "EXPENSE" as const },
  { name: "Subscriptions", color: "#6366f1", icon: "📱", kind: "EXPENSE" as const },
  { name: "Health & Fitness", color: "#14b8a6", icon: "💪", kind: "EXPENSE" as const },
  { name: "Insurance", color: "#78716c", icon: "🛡️", kind: "EXPENSE" as const },
  { name: "Utilities", color: "#eab308", icon: "💡", kind: "EXPENSE" as const },
  { name: "Education", color: "#0891b2", icon: "📚", kind: "EXPENSE" as const },
  { name: "Transfers", color: "#475569", icon: "↔️", kind: "TRANSFER" as const },
  { name: "ATM", color: "#334155", icon: "🏧", kind: "EXPENSE" as const },
  { name: "Bank Fees", color: "#94a3b8", icon: "🏦", kind: "EXPENSE" as const },
  { name: "Salary", color: "#3dd68c", icon: "💼", kind: "INCOME" as const },
  { name: "Sales", color: "#22c55e", icon: "🏷️", kind: "INCOME" as const },
  { name: "Interest", color: "#84cc16", icon: "📈", kind: "INCOME" as const },
  { name: "Income", color: "#4ade80", icon: "💰", kind: "INCOME" as const },
  { name: "Other", color: "#71717a", icon: "📦", isSystem: true, kind: "EXPENSE" as const },
] as const;
