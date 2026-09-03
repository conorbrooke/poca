import type { CurrencyAmount, TransactionTransferInfo } from "@poca/shared";

export type DashboardStats = {
  balancesByCurrency?: CurrencyAmount[];
  totalIncome: number;
  totalSpent: number;
  netFlow: number;
  transactionCount: number;
  avgTransactionSize: number;
  thisMonthIncome: number;
  thisMonthSpent: number;
};

export type DashboardAccount = {
  id: string;
  name: string;
  iban: string | null;
  currentBalance: number;
  currency: string;
  accountType: string | null;
  product: string | null;
  transactionCount: number;
};

export type DashboardBank = {
  id: string;
  institutionId: string;
  institutionName: string;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  balancesByCurrency: CurrencyAmount[];
  accounts: DashboardAccount[];
  stats: DashboardStats;
};

export type DashboardTransaction = {
  id: string;
  amount: number;
  amountEur: number;
  currency: string;
  description: string;
  payeeLabel: string | null;
  merchant: string | null;
  bookedAt: string;
  accountId: string;
  accountName: string;
  accountIban: string | null;
  bankConnectionId: string;
  institutionName: string;
  isSplit: boolean;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    kind?: "EXPENSE" | "INCOME" | "TRANSFER";
  } | null;
  tags: Array<{ id: string; name: string; color: string }>;
  splitCategories: Array<{
    name: string;
    color: string;
    icon: string | null;
  }>;
  splitTags: Array<{ id: string; name: string; color: string }>;
  transfer?: TransactionTransferInfo | null;
};

export type DashboardConnectionSummary = {
  id: string;
  institutionName: string;
  status: string;
};

export type DashboardResponse = {
  connections: DashboardConnectionSummary[];
  banks: DashboardBank[];
  stats: DashboardStats;
};

export type TransactionsResponse = {
  transactions: DashboardTransaction[];
  nextCursor: string | null;
};

export type Institution = {
  id: string;
  name: string;
  logo?: string;
  countries: string[];
};

export type BankConnection = {
  id: string;
  institutionId: string;
  institutionName: string;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
  accounts: DashboardAccount[];
};

export type LinkResponse = {
  connectionId: string;
  state: string;
  link: string;
};

export type SyncResponse = {
  syncedCount: number;
  syncJobId: string;
  daysBack: number;
};

export type {
  SpendingSummaryResponse,
  CategoryDetailResponse,
  SpendingCategorySummary,
  SpendingPayeeSummary,
  SpendingPeriodKind,
  SpendingRangeId,
  SpendingTransaction,
  TransactionDetail,
  TagOption,
  TagSummaryResponse,
  ReceiptSummary,
  SplitLineSummary,
  TransfersSummaryResponse,
  TransferLinkSummary,
  TransactionTransferInfo,
  CategoryKind,
} from "@poca/shared";

export type CategoryOption = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isSystem: boolean;
  kind: "EXPENSE" | "INCOME" | "TRANSFER";
};
