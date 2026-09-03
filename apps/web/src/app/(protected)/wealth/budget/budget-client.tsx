"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MonthPicker } from "../../../../components/wealth-nav";
import { apiFetch } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/format";

type BudgetLine = {
  categoryId: string;
  name: string;
  color: string;
  icon: string | null;
  amount: number;
  spent: number;
  remaining: number;
  transactionCount: number;
};

type Budget = {
  year: number;
  month: number;
  overallCap: number | null;
  totalBudgeted: number;
  totalSpent: number;
  remaining: number;
  lines: BudgetLine[];
};

export function BudgetClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [cap, setCap] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setMonth = useCallback(
    (nextYear: number, nextMonth: number) => {
      router.replace(`/wealth/budget?year=${nextYear}&month=${nextMonth}`);
    },
    [router],
  );

  const load = useCallback(async () => {
    setError(null);
    const result = await apiFetch<Budget>(
      `/wealth/budget?year=${year}&month=${month}`,
    );
    setBudget(result);
    setCap(result.overallCap != null ? String(result.overallCap) : "");
    setAmounts(
      Object.fromEntries(
        result.lines.map((line) => [line.categoryId, String(line.amount || "")]),
      ),
    );
  }, [year, month]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load budget");
    });
  }, [load]);

  async function save() {
    if (!budget) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/wealth/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: budget.year,
          month: budget.month,
          overallCap: cap === "" ? null : Number(cap),
          lines: budget.lines.map((line) => ({
            categoryId: line.categoryId,
            amount: Number(amounts[line.categoryId] || 0),
          })),
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save budget");
    } finally {
      setSaving(false);
    }
  }

  async function copyLast() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/wealth/budget/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, fromActuals: true }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not copy last month");
    } finally {
      setSaving(false);
    }
  }

  if (!budget && !error) {
    return <p className="bank-meta">Loading budget…</p>;
  }

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <MonthPicker year={year} month={month} onChange={setMonth} />
      {budget ? (
        <>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <p className="page-eyebrow">This month</p>
            <h2 className="spending-total">{formatMoney(budget.remaining)}</h2>
            <p className="bank-meta">
              {formatMoney(budget.totalSpent)} spent of{" "}
              {formatMoney(budget.totalBudgeted)} budgeted
            </p>
            <div className="tag-chip-row" style={{ marginTop: "1rem" }}>
              <label className="login-label">
                Optional overall cap
                <input
                  className="login-input"
                  type="number"
                  min="0"
                  step="1"
                  value={cap}
                  onChange={(event) => setCap(event.target.value)}
                  placeholder="e.g. 2200"
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => void copyLast()}
              >
                Copy last month’s actuals
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save budget"}
              </button>
            </div>
          </div>
          <div className="spending-category-list">
            {budget.lines.map((line) => (
              <div key={line.categoryId} className="spending-category-row">
                <div className="spending-category-main">
                  <span
                    className="spending-category-icon"
                    style={{ background: `${line.color}22` }}
                  >
                    {line.icon ?? "•"}
                  </span>
                  <div className="spending-category-copy">
                    <p className="spending-category-name">{line.name}</p>
                    <p className="bank-meta">
                      {formatMoney(line.spent)} spent · {line.transactionCount} tx
                    </p>
                  </div>
                </div>
                <input
                  className="login-input"
                  style={{ maxWidth: "8rem" }}
                  type="number"
                  min="0"
                  step="1"
                  value={amounts[line.categoryId] ?? ""}
                  onChange={(event) =>
                    setAmounts((current) => ({
                      ...current,
                      [line.categoryId]: event.target.value,
                    }))
                  }
                />
                <p
                  className="spending-category-amount"
                  style={{
                    color:
                      line.amount > 0 && line.spent > line.amount
                        ? "var(--expense)"
                        : undefined,
                  }}
                >
                  {formatMoney(line.remaining)} left
                </p>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
