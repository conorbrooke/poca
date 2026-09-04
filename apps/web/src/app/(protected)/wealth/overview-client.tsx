"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IRISH_WEALTH_NOTES } from "@poca/shared";
import { LineChart } from "../../../components/line-chart";
import { StatCard } from "../../../components/stats-grid";
import { apiFetch } from "../../../lib/api";
import { formatMoney } from "../../../lib/format";
import { useSpendingPeriod } from "../../../lib/spending-period";

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
  periodLabel: string;
  rolledFrom: { year: number; month: number } | null;
  income: number;
  spending: number;
  surplus: number;
  leftover: {
    priorMonthLabel: string;
    priorSurplus: number;
    priorSurplusLabel: string;
    afterBillsInsight: number;
    incomeThisMonth: number;
    expectedBills: number;
    billsByCategory: Array<{
      categoryId: string;
      name: string;
      color: string;
      isEssential: boolean;
      expected: number;
      spent: number;
    }>;
    variableLastMonth: number;
    loanLastMonth: number;
    spendingLimit: number;
    moneyIn: number;
  } | null;
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

type Series = {
  periodLabel: string;
  truncated: boolean;
  netWorth: Array<{ date: string; value: number }>;
  income: Array<{ date: string; value: number }>;
  spending: Array<{ date: string; value: number }>;
  surplus: Array<{ date: string; value: number }>;
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
  suffix,
}: {
  label: string;
  amount: number;
  href: string;
  suffix: string;
}) {
  if (amount === 0) return null;
  return (
    <Link href={`${href}${suffix}`} className="sheet-row">
      <span>{label}</span>
      <span className="sheet-row-value">{formatMoney(amount)}</span>
    </Link>
  );
}

export function WealthOverviewClient() {
  const { queryString } = useSpendingPeriod();
  const suffix = queryString ? `?${queryString}` : "";
  const [data, setData] = useState<Overview | null>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incomeMix, setIncomeMix] = useState<{
    total: number;
    sources: Array<{ name: string; total: number; share: number }>;
  } | null>(null);

  useEffect(() => {
    setError(null);
    const query = queryString ? `?${queryString}` : "";
    void Promise.all([
      apiFetch<Overview>(`/wealth/overview${query}`),
      apiFetch<Series>(`/wealth/series${query}`),
      apiFetch<{
        total: number;
        sources: Array<{ name: string; total: number; share: number }>;
      }>(`/wealth/income${query}`),
    ])
      .then(([overview, chart, mix]) => {
        setData(overview);
        setSeries(chart);
        setIncomeMix(mix);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load wealth");
      });
  }, [queryString]);

  if (!data && !error) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        <p>Loading this period…</p>
      </div>
    );
  }

  const growing = (data?.netWorthDelta ?? 0) > 0.004;
  const shrinking = (data?.netWorthDelta ?? 0) < -0.004;
  const emergencyShare =
    data && data.emergencyTarget > 0
      ? Math.min(100, Math.round((data.emergencySaved / data.emergencyTarget) * 100))
      : null;
  const visibleAssets = ASSET_ROWS.filter(
    (row) => data && data.allocation[row.key] !== 0,
  );
  const visibleLiabilities = LIABILITY_ROWS.filter(
    (row) => data && data.allocation[row.key] !== 0,
  );

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
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
              Assets {formatMoney(data.assets)}
              {data.liabilities > 0
                ? ` · liabilities ${formatMoney(data.liabilities)}`
                : ""}
            </p>
          </div>

          <div className="stats-grid">
            <StatCard
              label="This period surplus"
              value={formatMoney(data.surplus, "EUR", { signed: true })}
              hint={`${formatMoney(data.income)} in · ${formatMoney(data.spending)} out`}
              tone={data.surplus >= 0 ? "income" : "expense"}
            />
            <StatCard
              label="Savings rate"
              value={`${data.savingsRate}%`}
              hint={`Income minus expenses · ${data.periodLabel}`}
              tone={data.savingsRate >= 20 ? "income" : "default"}
            />
            {data.allocation.pension > 0 || data.pensionMonthlyIn > 0 ? (
              <StatCard
                label="Pension"
                value={formatMoney(data.allocation.pension)}
                hint={
                  data.pensionMonthlyIn > 0
                    ? `${formatMoney(data.pensionMonthlyIn)}/month going in`
                    : "Add monthly contributions on Pension"
                }
                tone="balance"
              />
            ) : (
              <StatCard
                label="Bills paid"
                value={formatMoney(data.billSpend)}
                hint={data.periodLabel}
              />
            )}
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

          {series ? (
            <div className="chart-grid">
              <div className="card">
                <h2 className="section-title">Net worth</h2>
                <p className="bank-meta" style={{ marginBottom: "0.75rem" }}>
                  {series.periodLabel}. Daily reconstructed bank cash plus
                  anything you have added (pension, property, debts).
                </p>
                <LineChart
                  series={[
                    {
                      id: "nw",
                      label: "Net worth",
                      color: "var(--accent)",
                      points: series.netWorth,
                    },
                  ]}
                />
              </div>
              <div className="card">
                <h2 className="section-title">Growing / shrinking</h2>
                <p className="bank-meta" style={{ marginBottom: "0.75rem" }}>
                  Cumulative surplus for {series.periodLabel}. Up means you kept
                  more than you spent.
                </p>
                <LineChart
                  series={[
                    {
                      id: "surplus",
                      label: "Cumulative surplus",
                      color:
                        (series.surplus.at(-1)?.value ?? 0) >= 0
                          ? "var(--income)"
                          : "var(--expense)",
                      points: series.surplus,
                    },
                  ]}
                />
              </div>
            </div>
          ) : null}

          {data.habitAlerts > 0 ? (
            <div className="alert alert-warning">
              {data.habitAlerts} spending leak{data.habitAlerts === 1 ? "" : "s"}{" "}
              to clear this period.{" "}
              <Link href={`/wealth/habits${suffix}`}>Open the spending check</Link>
            </div>
          ) : null}

          {data.overBudgetCount > 0 ? (
            <div className="alert alert-warning">
              {data.overBudgetCount} categor{data.overBudgetCount === 1 ? "y is" : "ies are"}{" "}
              over budget.{" "}
              <Link href={`/wealth/budget${suffix}`}>Open budget</Link>
            </div>
          ) : null}

          {data.rolledFrom ? (
            <p className="bank-meta" style={{ marginBottom: "0.75rem" }}>
              Budget carried from{" "}
              {new Date(data.rolledFrom.year, data.rolledFrom.month - 1, 1).toLocaleDateString(
                "en-IE",
                { month: "long", year: "numeric" },
              )}
              . Save on Budget to lock this month.
            </p>
          ) : null}

          <div className="balance-sheet">
            <div className="card">
              <div className="section-title-row">
                <h2 className="section-title">Assets</h2>
                <span className="bank-meta">{formatMoney(data.assets)}</span>
              </div>
              {visibleAssets.length === 0 ? (
                <p className="bank-meta">
                  Nothing listed yet. Add a pension, property, or vehicle on{" "}
                  <Link href={`/wealth/net-worth${suffix}`}>Net worth</Link> — empty
                  rows are hidden until you add them.
                </p>
              ) : (
                visibleAssets.map((row) => (
                  <SheetRow
                    key={row.key}
                    label={row.label}
                    amount={data.allocation[row.key]}
                    href={row.href}
                    suffix={suffix}
                  />
                ))
              )}
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
              {visibleLiabilities.length === 0 ? (
                <p className="bank-meta">
                  No debts added. A mortgage only appears after you add it on{" "}
                  <Link href={`/wealth/net-worth${suffix}`}>Net worth</Link>.
                </p>
              ) : (
                visibleLiabilities.map((row) => (
                  <SheetRow
                    key={row.key}
                    label={row.label}
                    amount={data.allocation[row.key]}
                    href={row.href}
                    suffix={suffix}
                  />
                ))
              )}
              <div className="sheet-total">
                <span>Total liabilities</span>
                <span>{formatMoney(data.liabilities)}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: "1rem" }}>
            <h2 className="section-title">This period</h2>
            <p className="bank-meta" style={{ marginBottom: "0.75rem" }}>
              {data.periodLabel}. Spending is all expenses. Flex on Spending
              excludes paid bills.
            </p>
            {data.leftover ? (
              <>
                <div className="waterflow">
                <div className="sheet-row">
                  <span>{data.leftover.priorSurplusLabel}</span>
                  <span className="sheet-row-value">
                    {formatMoney(data.leftover.priorSurplus, "EUR", { signed: true })}
                  </span>
                </div>
                <div className="sheet-row">
                  <span>This month’s income (in progress)</span>
                  <span className="sheet-row-value">
                    {formatMoney(data.leftover.incomeThisMonth)}
                  </span>
                </div>
                {data.leftover.billsByCategory.map((row) => (
                  <div key={row.categoryId} className="sheet-row">
                    <span>
                      {row.name}
                      {row.isEssential ? " · essential" : " · flexible"}
                    </span>
                    <span className="sheet-row-value">
                      {formatMoney(row.expected)}
                    </span>
                  </div>
                ))}
                <div className="sheet-row">
                  <span>Variable living last month</span>
                  <span className="sheet-row-value">
                    {formatMoney(data.leftover.variableLastMonth)}
                  </span>
                </div>
                {data.leftover.loanLastMonth > 0 ? (
                  <div className="sheet-row">
                    <span>Loan transfers last month</span>
                    <span className="sheet-row-value">
                      {formatMoney(data.leftover.loanLastMonth)}
                    </span>
                  </div>
                ) : null}
                <div className="sheet-total">
                  <span>Spending limit</span>
                  <span>{formatMoney(data.leftover.spendingLimit)}</span>
                </div>
                </div>
                <p className="bank-meta" style={{ marginTop: "0.75rem" }}>
                  After last month’s bills you had{" "}
                  {formatMoney(data.leftover.afterBillsInsight)} that was actually
                  free.
                </p>
              </>
            ) : (
              <>
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
              <Link href={`/wealth/bills${suffix}`} className="sheet-row-value">
                {formatMoney(data.billSpend)}
              </Link>
            </div>
            <div className="sheet-total">
              <span>Surplus</span>
              <span>{formatMoney(data.surplus, "EUR", { signed: true })}</span>
            </div>
              </>
            )}
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
              {formatMoney(incomeMix?.total ?? 0)} earned in {data.periodLabel}
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
