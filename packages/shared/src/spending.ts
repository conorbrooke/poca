import { z } from "zod";

export const SPENDING_RANGES = [
  { id: "week", label: "This week", days: 7 },
  { id: "month", label: "This month", days: 30 },
  { id: "quarter", label: "Last 3 months", days: 90 },
  { id: "6months", label: "Last 6 months", days: 180 },
  { id: "year", label: "Last year", days: 365 },
] as const;

export type SpendingRangeId = (typeof SPENDING_RANGES)[number]["id"];

export const spendingQuerySchema = z.object({
  range: z.enum(["week", "month", "quarter", "6months", "year"]).default("month"),
  bankConnectionId: z.string().min(1).optional(),
});

export type SpendingQuery = z.infer<typeof spendingQuerySchema>;

export const categoryIdParamSchema = z.object({
  id: z.string().min(1),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(8).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const recategorizeTransactionSchema = z.object({
  categoryId: z.string().min(1).optional(),
  payeeLabel: z.string().min(1).max(120),
  createRule: z.boolean().default(false),
  applyToSimilar: z.boolean().default(false),
});

export type RecategorizeTransactionInput = z.infer<
  typeof recategorizeTransactionSchema
>;

export const spendingTransactionsQuerySchema = z.object({
  range: z.enum(["week", "month", "quarter", "6months", "year"]).default("month"),
  bankConnectionId: z.string().min(1).optional(),
  payeeLabel: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
});

export type SpendingTransactionsQuery = z.infer<
  typeof spendingTransactionsQuerySchema
>;

export type SpendingCategorySummary = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isSystem: boolean;
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

export type SpendingSummaryResponse = {
  range: SpendingRangeId;
  periodStart: string;
  periodEnd: string;
  totalSpent: number;
  transactionCount: number;
  categories: SpendingCategorySummary[];
  cached: boolean;
};

export type CategoryDetailResponse = {
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    isSystem: boolean;
  };
  range: SpendingRangeId;
  periodStart: string;
  periodEnd: string;
  totalSpent: number;
  transactionCount: number;
  payees: SpendingPayeeSummary[];
  cached: boolean;
};

export const DEFAULT_CATEGORY_DEFINITIONS = [
  { name: "Restaurants", color: "#f97316", icon: "🍽️" },
  { name: "Groceries", color: "#22c55e", icon: "🛒" },
  { name: "Fuel", color: "#64748b", icon: "⛽" },
  { name: "Transport", color: "#3b82f6", icon: "🚌" },
  { name: "Travel", color: "#0ea5e9", icon: "✈️" },
  { name: "Entertainment", color: "#ec4899", icon: "🎬" },
  { name: "Shopping", color: "#8b5cf6", icon: "🛍️" },
  { name: "Subscriptions", color: "#6366f1", icon: "📱" },
  { name: "Health & Fitness", color: "#14b8a6", icon: "💪" },
  { name: "Insurance", color: "#78716c", icon: "🛡️" },
  { name: "Utilities", color: "#eab308", icon: "💡" },
  { name: "Education", color: "#0891b2", icon: "📚" },
  { name: "Transfers", color: "#475569", icon: "↔️" },
  { name: "ATM", color: "#334155", icon: "🏧" },
  { name: "Bank Fees", color: "#94a3b8", icon: "🏦" },
  { name: "Income", color: "#3dd68c", icon: "💰" },
  { name: "Other", color: "#71717a", icon: "📦", isSystem: true },
] as const;
