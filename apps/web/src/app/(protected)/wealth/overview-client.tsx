"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IRISH_WEALTH_NOTES } from "@poca/shared";
import { MonthPicker } from "../../../components/wealth-nav";
import { StatCard } from "../../../components/stats-grid";
import { apiFetch } from "../../../lib/api";
import { formatMoney } from "../../../lib/format";

type Allocation = {
  cash: number;
  savings: number;
  pension: number;
  investments: number;
  property: number;
  vehicles: number;
  otherAssets: number;
  mortgage: number;
  otherDebts: number;
};

type Overview = {
  year: number;
  month: number;
  income: number;
  spending: number;
  surplus: number;
  savingsRate: number;
  interestGross: number;
  interestAfterDirt: number;
  budgeted: number;
  spentOfBudget: number;
  remaining: number;
  overallCap: number | null;
  overBudgetCount: number;
  netWorth: number;
  netWorthDelta: number;
  assets: number;
  liabilities: number;
  allocation: Allocation;
  pensionMonthlyIn: number;
  billSpend: number;
  essentialMonthly: number;
  emergencyTarget: number;
  emergencySaved: number;
  habitAlerts: number;
};

const ASSET_ROWS: Array<{ key: keyof Allocation; label: string; href: string }> = [
  { key: "cash", label: "Cash", href: "/wealth/net-worth" },
  { key: "savings", label: "Savings", href: "/wealth/goals" },
  { key: "investments", label: "Investments", href: "/wealth/investments" },
  { key: "pension", label: "Pension", href: "/wealth/pension" },
  { key: "property", label: "Property", href: "/wealth/net-worth" },
  { key: "vehicles", label: "Vehicles", href: "/wealth/net-worth" },
  { key: "otherAssets", label: "Other assets", href: "/wealth/net-worth" },
];

const LIABILITY_ROWS: Array<{
  key: keyof Allocation;
  label: string;
  href: string;
}> = [
  { key: "mortgage", label: "Mortgage", href: "/wealth/net-worth" },
  { key: "otherDebts", label: "Other debts", href: "/wealth/net-worth" },
];

function SheetRow({
  label,
  amount,
  href,
  year,
  month,
  muted,
}: {
  label: string;
  amount: number;
  href: string;
  year: number;
  month: number;
  muted?: boolean;
}) {
  if (muted && amount === 0) return null;
  return (
    <Link
      href={`${href}?year=${year}&month=${month}`}
      className={`sheet-row${amount === 0 ? " sheet-row-empty" : ""}`}
    >
      <span>{label}</span>
      <span className="sheet-row-value">{formatMoney(amount)}</span>
    </Link>
  );
}

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

  const growing = (data?.netWorthDelta ?? 0) > 0.004;
  const shrinking = (data?.netWorthDelta ?? 0) < -0.004;
  const emergencyShare =
    data && data.emergencyTarget > 0
      ? Math.min(100, Math.round((data.emergencySaved / data.emergencyTarget) * 100))
      : null;

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <MonthPicker year={year} month={month} onChange={setMonth} />
      {data ? (
        <>
          <div className="hero-net-worth card">
            <p className="page-eyebrow">Net worth</p>
            <p className="hero-net-worth-value">{formatMoney(data.netWorth)}</p>
            <p
              className={`hero-net-worth-delta${
                growing ? " is-up" : shrinking ? " is-down" : ""
              }`}
            >
              {growing
                ? `Growing ${formatMoney(data.netWorthDelta, "EUR", { signed: true })} vs last snapshot`
                : shrinking
                  ? `Shrinking ${formatMoney(data.netWorthDelta, "EUR", { signed: true })} vs last snapshot`
                  : "Unchanged vs last snapshot"}
            </p>
            <p className="bank-meta">
              Assets {formatMoney(data.assets)} · liabilities{" "}
              {formatMoney(data.liabilities)}
            </p>
          </div>

          <div className="stats-grid">
            <StatCard
              label="This month surplus"
              value={formatMoney(data.surplus, "EUR", { signed: true })}
              hint={`${formatMoney(data.income)} in · ${formatMoney(data.spending)} out`}
              tone={data.surplus >= 0 ? "income" : "expense"}
            />
            <StatCard
              label="Savings rate"
              value={`${data.savingsRate}%`}
              hint="Income minus expenses this month"
              tone={data.savingsRate >= 20 ? "income" : "default"}
            />
            <StatCard
              label="Pension growing"
              value={formatMoney(data.allocation.pension)}
              hint={
                data.pensionMonthlyIn > 0
                  ? `${formatMoney(data.pensionMonthlyIn)}/month going in`
                  : "Add monthly contributions on Pension"
              }
              tone="balance"
            />
            <StatCard
              label="Emergency fund"
              value={formatMoney(data.emergencySaved)}
              hint={
                data.emergencyTarget > 0
                  ? `${emergencyShare}% of ${formatMoney(data.emergencyTarget)} (3× essential bills)`
                  : "Mark bills as essential to set a target"
              }
            />
          </div>

          {data.habitAlerts > 0 ? (
            <div className="alert alert-warning">
              {data.habitAlerts} spending leak{data.habitAlerts === 1 ? "" : "s"}{" "}
              to clear this month.{" "}
              <Link href={`/wealth/habits?year=${year}&month=${month}`}>
                Open the spending check
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

          <div className="balance-sheet">
            <div className="card">
              <div className="section-title-row">
                <h2 className="section-title">Assets</h2>
                <span className="bank-meta">{formatMoney(data.assets)}</span>
              </div>
              {ASSET_ROWS.map((row) => (
                <SheetRow
                  key={row.key}
                  label={row.label}
                  amount={data.allocation[row.key]}
                  href={row.href}
                  year={year}
                  month={month}
                  muted={row.key === "otherAssets"}
                />
              ))}
              <div className="sheet-total">
                <span>Total assets</span>
                <span>{formatMoney(data.assets)}</span>
              </div>
            </div>
            <div className="card">
              <div className="section-title-row">
                <h2 className="section-title">Liabilities</h2>
                <span className="bank-meta">{formatMoney(data.liabilities)}</span>
              </div>
              {LIABILITY_ROWS.map((row) => (
                <SheetRow
                  key={row.key}
                  label={row.label}
                  amount={data.allocation[row.key]}
                  href={row.href}
                  year={year}
                  month={month}
                />
              ))}
              <div className="sheet-total">
                <span>Total liabilities</span>
                <span>{formatMoney(data.liabilities)}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: "1rem" }}>
            <h2 className="section-title">This month</h2>
            <p className="bank-meta" style={{ marginBottom: "0.75rem" }}>
              Cashflow for the calendar month — bills are included in spending,
              not a separate pot.
            </p>
            <div className="sheet-row">
              <span>Income</span>
              <span className="sheet-row-value">{formatMoney(data.income)}</span>
            </div>
            <div className="sheet-row">
              <span>Spending</span>
              <span className="sheet-row-value">{formatMoney(data.spending)}</span>
            </div>
            <div className="sheet-row">
              <span>Bills paid</span>
              <Link
                href={`/wealth/bills?year=${year}&month=${month}`}
                className="sheet-row-value"
              >
                {formatMoney(data.billSpend)}
              </Link>
            </div>
            <div className="sheet-total">
              <span>Surplus</span>
              <span>{formatMoney(data.surplus, "EUR", { signed: true })}</span>
            </div>
            <p className="bank-meta" style={{ marginTop: "0.75rem" }}>
              Budget remaining {formatMoney(data.remaining)}
              {data.overallCap
                ? ` · cap ${formatMoney(data.overallCap)}`
                : ` · ${formatMoney(data.spentOfBudget)} of ${formatMoney(data.budgeted)}`}
              .
            </p>
          </div>

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
