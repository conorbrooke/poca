"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MonthPicker } from "../../../../components/wealth-nav";
import { apiFetch } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/format";

type Habits = {
  alerts: Array<{ type: string; title: string; detail: string }>;
  merchants: Array<{
    payee: string;
    count: number;
    total: number;
    previousTotal: number;
  }>;
  weekday: { weekday: number; weekend: number };
  leaks: Array<{ label: string; total: number; count: number }>;
};

export function HabitsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);
  const [data, setData] = useState<Habits | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setMonth = useCallback(
    (nextYear: number, nextMonth: number) => {
      router.replace(`/wealth/habits?year=${nextYear}&month=${nextMonth}`);
    },
    [router],
  );

  useEffect(() => {
    void apiFetch<Habits>(`/wealth/habits?year=${year}&month=${month}`)
      .then(setData)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load habits");
      });
  }, [year, month]);

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <MonthPicker year={year} month={month} onChange={setMonth} />
      {data?.alerts.length ? (
        data.alerts.map((alert) => (
          <div key={alert.title} className="alert alert-warning">
            <strong>{alert.title}</strong>
            <div>{alert.detail}</div>
          </div>
        ))
      ) : (
        <p className="bank-meta">No budget breaches or leak flags this month.</p>
      )}

      {data ? (
        <>
          <div className="card" style={{ margin: "1rem 0" }}>
            <h2 className="section-title">Weekday vs weekend</h2>
            <p className="bank-meta">
              Weekdays {formatMoney(data.weekday.weekday)} · Weekends{" "}
              {formatMoney(data.weekday.weekend)}
            </p>
          </div>
          <h2 className="section-title">Repeat merchants</h2>
          <div className="spending-category-list">
            {data.merchants.map((row) => (
              <div key={row.payee} className="spending-category-row">
                <div>
                  <p className="spending-category-name">{row.payee}</p>
                  <p className="bank-meta">
                    {row.count} times · last month {formatMoney(row.previousTotal)}
                  </p>
                </div>
                <p className="spending-category-amount">{formatMoney(row.total)}</p>
              </div>
            ))}
          </div>
          <h2 className="section-title" style={{ marginTop: "1.5rem" }}>
            Leaks
          </h2>
          <div className="spending-category-list">
            {data.leaks.map((leak) => (
              <div key={leak.label} className="spending-category-row">
                <div>
                  <p className="spending-category-name">{leak.label}</p>
                  <p className="bank-meta">{leak.count} transactions</p>
                </div>
                <p className="spending-category-amount">{formatMoney(leak.total)}</p>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
