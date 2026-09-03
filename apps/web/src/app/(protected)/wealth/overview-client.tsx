"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IRISH_WEALTH_NOTES } from "@poca/shared";
import { MonthPicker } from "../../../components/wealth-nav";
import { StatCard } from "../../../components/stats-grid";
import { apiFetch } from "../../../lib/api";
import { formatMoney } from "../../../lib/format";

type Overview = {
  year: number;
  month: number;
  income: number;
  spending: number;
  savingsRate: number;
  interestGross: number;
  interestAfterDirt: number;
  budgeted: number;
  spentOfBudget: number;
  remaining: number;
  overallCap: number | null;
  overBudgetCount: number;
  netWorth: number;
  essentialMonthly: number;
  emergencyTarget: number;
  emergencySaved: number;
  habitAlerts: number;
};

export function WealthOverviewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incomeMix, setIncomeMix] = useState<{
    total: number;
    sources: Array<{ name: string; total: number; share: number }>;
  } | null>(null);

  const setMonth = useCallback(
    (nextYear: number, nextMonth: number) => {
      router.replace(`/wealth?year=${nextYear}&month=${nextMonth}`);
    },
    [router],
  );

  useEffect(() => {
    setError(null);
    void Promise.all([
      apiFetch<Overview>(`/wealth/overview?year=${year}&month=${month}`),
      apiFetch<{
        total: number;
        sources: Array<{ name: string; total: number; share: number }>;
      }>(`/wealth/income?year=${year}&month=${month}`),
    ])
      .then(([overview, mix]) => {
        setData(overview);
        setIncomeMix(mix);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load wealth");
      });
  }, [year, month]);

  if (!data && !error) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        <p>Loading this month…</p>
      </div>
    );
  }

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <MonthPicker year={year} month={month} onChange={setMonth} />
      {data ? (
        <>
          <div className="stats-grid">
            <StatCard
              label="Savings rate"
              value={`${data.savingsRate}%`}
              hint="Income minus expenses this month"
              tone={data.savingsRate >= 20 ? "income" : "default"}
            />
            <StatCard
              label="Left in budget"
              value={formatMoney(data.remaining)}
              hint={
                data.overallCap
                  ? `Cap ${formatMoney(data.overallCap)}`
                  : `${formatMoney(data.spentOfBudget)} of ${formatMoney(data.budgeted)}`
              }
              tone={data.remaining >= 0 ? "income" : "expense"}
            />
            <StatCard
              label="Net worth"
              value={formatMoney(data.netWorth)}
              hint="Assets minus liabilities"
              tone="balance"
            />
            <StatCard
              label="Emergency fund"
              value={formatMoney(data.emergencySaved)}
              hint={
                data.emergencyTarget > 0
                  ? `Target ${formatMoney(data.emergencyTarget)} (3× essential bills)`
                  : "Mark bills as essential to set a target"
              }
            />
          </div>

          {data.habitAlerts > 0 ? (
            <div className="alert alert-warning">
              {data.habitAlerts} habit alert{data.habitAlerts === 1 ? "" : "s"} this
              month.{" "}
              <Link href={`/wealth/habits?year=${year}&month=${month}`}>
                Review habits
              </Link>
            </div>
          ) : null}

          {data.overBudgetCount > 0 ? (
            <div className="alert alert-warning">
              {data.overBudgetCount} categor{data.overBudgetCount === 1 ? "y is" : "ies are"}{" "}
              over budget.{" "}
              <Link href={`/wealth/budget?year=${year}&month=${month}`}>
                Open budget
              </Link>
            </div>
          ) : null}

          <div className="card" style={{ marginTop: "1rem" }}>
            <h2 className="section-title">Income mix</h2>
            <p className="bank-meta" style={{ marginBottom: "0.75rem" }}>
              {formatMoney(incomeMix?.total ?? 0)} earned this month
            </p>
            {(incomeMix?.sources ?? []).filter((row) => row.total > 0).length ===
            0 ? (
              <p className="bank-meta">No income categories with activity yet.</p>
            ) : (
              <div className="spending-category-list">
                {incomeMix?.sources
                  .filter((row) => row.total > 0)
                  .map((row) => (
                    <div key={row.name} className="spending-category-row">
                      <div className="spending-category-copy">
                        <p className="spending-category-name">{row.name}</p>
                        <p className="bank-meta">{row.share}% of earned income</p>
                      </div>
                      <p className="spending-category-amount">
                        {formatMoney(row.total)}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {data.interestGross > 0 ? (
            <p className="bank-meta" style={{ marginTop: "1rem" }}>
              Deposit interest {formatMoney(data.interestGross)} gross, about{" "}
              {formatMoney(data.interestAfterDirt)} after DIRT. {IRISH_WEALTH_NOTES.dirt}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
