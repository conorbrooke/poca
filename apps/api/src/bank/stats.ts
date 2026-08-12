import type { ConnectionStats } from "@poca/shared";

type TransactionRecord = {
  amount: { toString(): string };
  bookedAt: Date;
};

function toNumber(value: { toString(): string }): number {
  return parseFloat(value.toString());
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeStats(transactions: TransactionRecord[]): ConnectionStats {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalIncome = 0;
  let totalSpent = 0;
  let thisMonthIncome = 0;
  let thisMonthSpent = 0;

  for (const tx of transactions) {
    const amount = toNumber(tx.amount);
    const bookedAt = tx.bookedAt;

    if (amount >= 0) {
      totalIncome += amount;
      if (bookedAt >= monthStart) {
        thisMonthIncome += amount;
      }
    } else {
      totalSpent += Math.abs(amount);
      if (bookedAt >= monthStart) {
        thisMonthSpent += Math.abs(amount);
      }
    }
  }

  const transactionCount = transactions.length;
  const totalVolume = transactions.reduce(
    (sum, tx) => sum + Math.abs(toNumber(tx.amount)),
    0,
  );

  return {
    totalIncome: roundMoney(totalIncome),
    totalSpent: roundMoney(totalSpent),
    netFlow: roundMoney(totalIncome - totalSpent),
    transactionCount,
    avgTransactionSize: roundMoney(
      transactionCount > 0 ? totalVolume / transactionCount : 0,
    ),
    thisMonthIncome: roundMoney(thisMonthIncome),
    thisMonthSpent: roundMoney(thisMonthSpent),
  };
}

export function mergeStats(
  statsList: ConnectionStats[],
  totalBalance?: number,
): ConnectionStats & { totalBalance?: number } {
  const merged = statsList.reduce<ConnectionStats>(
    (acc, stats) => ({
      totalIncome: roundMoney(acc.totalIncome + stats.totalIncome),
      totalSpent: roundMoney(acc.totalSpent + stats.totalSpent),
      netFlow: roundMoney(acc.netFlow + stats.netFlow),
      transactionCount: acc.transactionCount + stats.transactionCount,
      avgTransactionSize: 0,
      thisMonthIncome: roundMoney(acc.thisMonthIncome + stats.thisMonthIncome),
      thisMonthSpent: roundMoney(acc.thisMonthSpent + stats.thisMonthSpent),
    }),
    {
      totalIncome: 0,
      totalSpent: 0,
      netFlow: 0,
      transactionCount: 0,
      avgTransactionSize: 0,
      thisMonthIncome: 0,
      thisMonthSpent: 0,
    },
  );

  const totalVolume = statsList.reduce((sum, stats) => {
    return sum + stats.avgTransactionSize * stats.transactionCount;
  }, 0);

  merged.avgTransactionSize = roundMoney(
    merged.transactionCount > 0
      ? totalVolume / merged.transactionCount
      : 0,
  );

  if (totalBalance !== undefined) {
    return { ...merged, totalBalance: roundMoney(totalBalance) };
  }

  return merged;
}

export function connectionStatsFromRow(row: {
  totalIncome: { toString(): string };
  totalSpent: { toString(): string };
  netFlow: { toString(): string };
  transactionCount: number;
  avgTransactionSize: { toString(): string };
  thisMonthIncome: { toString(): string };
  thisMonthSpent: { toString(): string };
}): ConnectionStats {
  return {
    totalIncome: toNumber(row.totalIncome),
    totalSpent: toNumber(row.totalSpent),
    netFlow: toNumber(row.netFlow),
    transactionCount: row.transactionCount,
    avgTransactionSize: toNumber(row.avgTransactionSize),
    thisMonthIncome: toNumber(row.thisMonthIncome),
    thisMonthSpent: toNumber(row.thisMonthSpent),
  };
}

export function connectionStatsToDb(stats: ConnectionStats) {
  return {
    totalIncome: stats.totalIncome,
    totalSpent: stats.totalSpent,
    netFlow: stats.netFlow,
    transactionCount: stats.transactionCount,
    avgTransactionSize: stats.avgTransactionSize,
    thisMonthIncome: stats.thisMonthIncome,
    thisMonthSpent: stats.thisMonthSpent,
    computedAt: new Date(),
  };
}

export function isStatsMonthStale(computedAt: Date | null | undefined): boolean {
  if (!computedAt) return true;
  const now = new Date();
  return (
    computedAt.getMonth() !== now.getMonth() ||
    computedAt.getFullYear() !== now.getFullYear()
  );
}

export function syncDateFrom(daysBack: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString();
}
