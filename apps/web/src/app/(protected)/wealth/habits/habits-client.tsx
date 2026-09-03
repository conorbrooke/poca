"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatCard } from "../../../../components/stats-grid";
import { apiFetch } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/format";
import { useSpendingPeriod } from "../../../../lib/spending-period";

type Action = {
  id: string;
  severity: "high" | "medium" | "ok";
  title: string;
  why: string;
  doNext: string;
  href: string;
  amount: number;
};

type Habits = {
  year: number;
  month: number;
  income: number;
  spending: number;
  surplus: number;
  previousSpending: number;
  spendingDelta: number;
  actions: Action[];
  merchants: Array<{
    payee: string;
    count: number;
    total: number;
    previousTotal: number;
    delta: number;
    isNew: boolean;
    isFrequent: boolean;
    jumped: boolean;
  }>;
  weekday: {
    weekday: number;
    weekend: number;
    weekendShare: number;
    insight: string;
  };
  time: {
    early: number;
    late: number;
    lateShare: number;
    tooEarly: boolean;
    insight: string;
  };
  leaks: Array<{
    id: string;
    label: string;
    total: number;
    count: number;
    href: string;
    why: string;
    doNext: string;
  }>;
  surplusEaters: Array<{
    categoryId: string;
    name: string;
    total: number;
    previousTotal: number;
    delta: number;
    href: string;
  }>;
};

export function HabitsClient() {
  const { queryString } = useSpendingPeriod();
  const [data, setData] = useState<Habits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void apiFetch<Habits>(`/wealth/habits${queryString ? `?${queryString}` : ""}`)
      .then(setData)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load spending check");
      })
      .finally(() => setLoading(false));
  }, [queryString]);

  if (loading && !data) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        <p>Checking this month’s spending…</p>
      </div>
    );
  }

  const highCount = data?.actions.filter((action) => action.severity === "high").length ?? 0;
  const notableMerchants =
    data?.merchants.filter(
      (row) => row.jumped || row.isFrequent || row.isNew || row.total >= 40,
    ) ?? [];

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="habits-intro">
        <p className="page-eyebrow">Spending check</p>
        <h2 className="section-title" style={{ marginBottom: "0.4rem" }}>
          Where this period leaked
        </h2>
        <p className="bank-meta" style={{ maxWidth: "62ch" }}>
          This page is a diagnostic, not a score. It compares expense spend to
          your budget and the previous window of the same length, then tells
          you what to fix — uncategorised cash, Revolut top-ups counted twice,
          categories over plan, and merchants that jumped.
        </p>
      </div>

      <div className="habits-howto">
        <div className="card habits-howto-step">
          <strong>1. Make the numbers true</strong>
          <p className="bank-meta">
            Recategorise ATM, Other, and Revolut top-ups first. Insights are
            only as good as the ledger.
          </p>
        </div>
        <div className="card habits-howto-step">
          <strong>2. Work the list below</strong>
          <p className="bank-meta">
            Start with high items. Each one links to the category, budget, or
            guide so you can act in one tap.
          </p>
        </div>
        <div className="card habits-howto-step">
          <strong>3. Cut or budget the rest</strong>
          <p className="bank-meta">
            If a merchant or weekend pattern is real spend, set a budget or
            trim it. If it was a one-off, leave it.
          </p>
        </div>
      </div>

      {data ? (
        <>
          <div className="stats-grid">
            <StatCard
              label="Expense spend"
              value={formatMoney(data.spending)}
              hint={
                data.spendingDelta === 0
                  ? "Same as last month"
                  : `${data.spendingDelta > 0 ? "+" : ""}${formatMoney(data.spendingDelta)} vs last month`
              }
              tone="expense"
            />
            <StatCard
              label="Left after expenses"
              value={formatMoney(data.surplus)}
              hint={`${formatMoney(data.income)} earned`}
              tone={data.surplus >= 0 ? "income" : "expense"}
            />
            <StatCard
              label="To action"
              value={String(highCount)}
              hint={highCount > 0 ? "High-priority leaks" : "Nothing urgent"}
              tone={highCount > 0 ? "expense" : "income"}
            />
          </div>

          <h2 className="section-title" style={{ marginTop: "1.5rem" }}>
            Do this next
          </h2>
          <div className="spending-category-list">
            {data.actions.map((action) => (
              <Link
                key={action.id}
                href={action.href}
                className="spending-category-row habits-action"
              >
                <div className="spending-category-copy">
                  <p className="spending-category-name">{action.title}</p>
                  <p className="bank-meta">{action.why}</p>
                  <p className="bank-meta">
                    <strong>{action.severity === "ok" ? "Keep going:" : "Next:"}</strong>{" "}
                    {action.doNext}
                  </p>
                </div>
                {action.amount > 0 ? (
                  <p className="spending-category-amount">{formatMoney(action.amount)}</p>
                ) : (
                  <span className="range-tab active">
                    {action.severity === "ok" ? "OK" : action.severity}
                  </span>
                )}
              </Link>
            ))}
          </div>

          <h2 className="section-title" style={{ marginTop: "1.75rem" }}>
            Categories that used the surplus
          </h2>
          <p className="bank-meta" style={{ marginBottom: "0.75rem" }}>
            Biggest expense categories this month versus last month. Open one
            to recategorise or inspect merchants.
          </p>
          <div className="spending-category-list">
            {data.surplusEaters.length === 0 ? (
              <p className="bank-meta">No expense spend in this month.</p>
            ) : (
              data.surplusEaters.map((row) => (
                <Link
                  key={row.categoryId}
                  href={row.href}
                  className="spending-category-row habits-action"
                >
                  <div>
                    <p className="spending-category-name">{row.name}</p>
                    <p className="bank-meta">
                      Last month {formatMoney(row.previousTotal)}
                      {row.delta !== 0 ? (
                        <span
                          className={`habits-delta ${row.delta > 0 ? "up" : "down"}`}
                        >
                          {" "}
                          · {row.delta > 0 ? "+" : ""}
                          {formatMoney(row.delta)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <p className="spending-category-amount">{formatMoney(row.total)}</p>
                </Link>
              ))
            )}
          </div>

          <div className="card" style={{ margin: "1.75rem 0 1rem" }}>
            <h2 className="section-title">When the money went</h2>
            <p className="bank-meta" style={{ marginBottom: "0.75rem" }}>
              Weekdays {formatMoney(data.weekday.weekday)} · Fri–Sun{" "}
              {formatMoney(data.weekday.weekend)} ({data.weekday.weekendShare}%
              weekend)
            </p>
            <p className="bank-meta">{data.weekday.insight}</p>
            <p className="bank-meta" style={{ marginTop: "0.75rem" }}>
              1st–21st {formatMoney(data.time.early)} · 22nd onwards{" "}
              {formatMoney(data.time.late)}
              {data.time.tooEarly ? "" : ` (${data.time.lateShare}% late)`}
            </p>
            <p className="bank-meta">{data.time.insight}</p>
          </div>

          <h2 className="section-title">Merchants worth a look</h2>
          <p className="bank-meta" style={{ marginBottom: "0.75rem" }}>
            Frequent visits, new names, or a jump versus last month — not just
            the largest totals.
          </p>
          <div className="spending-category-list">
            {notableMerchants.length === 0 ? (
              <p className="bank-meta">No standout merchants this month.</p>
            ) : (
              notableMerchants.map((row) => (
                <div key={row.payee} className="spending-category-row">
                  <div>
                    <p className="spending-category-name">{row.payee}</p>
                    <p className="bank-meta">
                      {row.count} time{row.count === 1 ? "" : "s"}
                      {row.isFrequent ? " · frequent" : ""}
                      {row.isNew ? " · new" : ""}
                      {row.jumped ? " · jumped" : ""}
                      {" · last month "}
                      {formatMoney(row.previousTotal)}
                    </p>
                  </div>
                  <p className="spending-category-amount">
                    {formatMoney(row.total)}
                    {row.delta !== 0 ? (
                      <span
                        className={`habits-delta ${row.delta > 0 ? "up" : "down"}`}
                        style={{ display: "block", fontSize: "0.8rem" }}
                      >
                        {row.delta > 0 ? "+" : ""}
                        {formatMoney(row.delta)}
                      </span>
                    ) : null}
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
