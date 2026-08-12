export type DashboardStats = {
  totalBalance?: number;
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
  transactionCount: number;
};

export type DashboardBank = {
  id: string;
  institutionId: string;
  institutionName: string;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  totalBalance: number;
  accounts: DashboardAccount[];
  stats: DashboardStats;
};

export type DashboardTransaction = {
  id: string;
  amount: number;
  currency: string;
  description: string;
  merchant: string | null;
  bookedAt: string;
  accountId: string;
  accountName: string;
  accountIban: string | null;
  bankConnectionId: string;
  institutionName: string;
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
  SpendingRangeId,
} from "@poca/shared";

export type CategoryOption = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isSystem: boolean;
};

export type SpendingTransaction = {
  id: string;
  amount: number;
  currency: string;
  description: string;
  merchant: string | null;
  payeeLabel: string | null;
  bookedAt: string;
  categoryId: string | null;
  categoryName: string | null;
  institutionName: string;
};
