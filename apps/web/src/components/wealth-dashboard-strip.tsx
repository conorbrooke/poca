"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";
import { formatMoney } from "../lib/format";
import { StatCard } from "./stats-grid";

type Overview = {
  savingsRate: number;
  remaining: number;
  netWorth: number;
  habitAlerts: number;
};

export function WealthDashboardStrip() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    void apiFetch<Overview>("/wealth/overview")
      .then(setData)
      .catch(() => {
        setData(null);
      });
  }, []);

  if (!data) return null;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div className="section-title-row" style={{ marginBottom: "0.75rem" }}>
        <h2 className="section-title">This month’s wealth</h2>
        <Link href="/wealth" className="bank-meta">
          Open wealth →
        </Link>
      </div>
      <div className="stats-grid">
        <StatCard
          label="Savings rate"
          value={`${data.savingsRate}%`}
          tone={data.savingsRate >= 20 ? "income" : "default"}
        />
        <StatCard
          label="Left in budget"
          value={formatMoney(data.remaining)}
          tone={data.remaining >= 0 ? "income" : "expense"}
        />
        <StatCard
          label="Net worth"
          value={formatMoney(data.netWorth)}
          tone="balance"
        />
        <StatCard
          label="Habit alerts"
          value={String(data.habitAlerts)}
          hint={data.habitAlerts > 0 ? "Review Wealth → Habits" : "None this month"}
        />
      </div>
    </div>
  );
}
