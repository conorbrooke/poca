import type { DashboardStats } from "../lib/types";
import { formatMoney, formatMoneyList } from "../lib/format";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "income" | "expense" | "balance";
};

export function StatCard({ label, value, hint, tone = "default" }: StatCardProps) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone === "default" ? "" : tone}`}>{value}</span>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  );
}

type StatsGridProps = {
  stats: DashboardStats;
  showBalance?: boolean;
};

export function StatsGrid({ stats, showBalance = true }: StatsGridProps) {
  return (
    <div className="stats-grid">
      {showBalance ? (
        <StatCard
          label="Current balance"
          value={formatMoneyList(stats.balancesByCurrency ?? [])}
          tone="balance"
          hint={
            (stats.balancesByCurrency?.length ?? 0) > 1
              ? "Each currency shown separately — not converted"
              : "Across linked accounts"
          }
        />
      ) : null}
      <StatCard
        label="Total spent"
        value={formatMoney(stats.totalSpent)}
        tone="expense"
        hint={`${stats.transactionCount} transactions`}
      />
      <StatCard
        label="Total income"
        value={formatMoney(stats.totalIncome)}
        tone="income"
      />
      <StatCard
        label="Net flow"
        value={formatMoney(stats.netFlow, "EUR", { signed: true })}
        tone={stats.netFlow >= 0 ? "income" : "expense"}
        hint="Income minus spending"
      />
      <StatCard
        label="This month spent"
        value={formatMoney(stats.thisMonthSpent)}
        tone="expense"
      />
      <StatCard
        label="This month income"
        value={formatMoney(stats.thisMonthIncome)}
        tone="income"
      />
      <StatCard
        label="Avg transaction"
        value={formatMoney(stats.avgTransactionSize)}
        hint="Mean absolute size"
      />
    </div>
  );
}
