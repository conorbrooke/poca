"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IRISH_BILL_PRESETS, spendingPeriodLabel } from "@poca/shared";
import { apiFetch } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/format";
import { useSpendingPeriod } from "../../../../lib/spending-period";

type Bill = {
  id: string;
  categoryId: string;
  name: string;
  color: string;
  icon: string | null;
  cadence: string;
  isEssential: boolean;
  spentThisMonth: number;
  transactionCount: number;
  monthlyAmount: number;
};

export function BillsClient() {
  const { period, queryString } = useSpendingPeriod();
  const suffix = queryString ? `?${queryString}` : "";
  const [bills, setBills] = useState<Bill[]>([]);
  const [suggestions, setSuggestions] = useState<
    Array<{ name: string; typicalAmount: number; payeeMatch: string; count: number }>
  >([]);
  const [name, setName] = useState("");
  const [essential, setEssential] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [list, suggested] = await Promise.all([
      apiFetch<Bill[]>(`/wealth/bills${suffix}`),
      apiFetch<typeof suggestions>("/wealth/bills/suggestions"),
    ]);
    setBills(list);
    setSuggestions(suggested);
  }

  useEffect(() => {
    void reload().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load bills");
    });
  }, [queryString]);

  async function create(
    billName = name,
    isEssential = essential,
    cadence: "WEEKLY" | "MONTHLY" | "YEARLY" = "MONTHLY",
  ) {
    const trimmed = billName.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await apiFetch("/wealth/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          cadence,
          isEssential,
        }),
      });
      setName("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add bill");
    }
  }

  async function toggleEssential(bill: Bill) {
    await apiFetch(`/wealth/bills/${bill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: bill.name,
        cadence: bill.cadence,
        isEssential: !bill.isEssential,
      }),
    });
    await reload();
  }

  async function remove(id: string) {
    await apiFetch(`/wealth/bills/${id}`, { method: "DELETE" });
    await reload();
  }

  const essentialMonthly = bills
    .filter((bill) => bill.isEssential)
    .reduce((sum, bill) => sum + bill.monthlyAmount, 0);
  const monthLabel = spendingPeriodLabel(period);

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="section-title">Recurring bills</h2>
        <p className="bank-meta" style={{ maxWidth: "62ch" }}>
          A bill is a spending category — rent, ESB, broadband — not a separate
          ledger. Categorise the transaction as Rent (or tick Recurring bill on
          the category) and it shows here with this month’s actual spend, still
          on Spending, and it will not be flagged as a leak.
        </p>
        <p className="bank-meta" style={{ marginTop: "0.5rem" }}>
          Essential bills in {monthLabel}: {formatMoney(essentialMonthly)}.
          Emergency fund target uses 3× this figure.
        </p>
        <div className="tag-chip-row" style={{ marginTop: "0.75rem" }}>
          {IRISH_BILL_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="tag-chip"
              onClick={() =>
                void create(preset.name, preset.essential, preset.cadence)
              }
            >
              {preset.name}
            </button>
          ))}
        </div>
        <div className="tag-chip-row" style={{ marginTop: "0.75rem" }}>
          <input
            className="login-input"
            placeholder="New bill category"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <label className="bank-meta">
            <input
              type="checkbox"
              checked={essential}
              onChange={(event) => setEssential(event.target.checked)}
            />{" "}
            Essential
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void create()}
          >
            Add bill category
          </button>
        </div>
      </div>

      <div className="spending-category-list">
        {bills.length === 0 ? (
          <div className="empty-state card">
            <h3>No bill categories yet</h3>
            <p>
              Add Rent from the chips, or open a spending category and tick
              Recurring bill.
            </p>
          </div>
        ) : (
          bills.map((bill) => (
            <div key={bill.id} className="spending-category-row">
              <div>
                <p className="spending-category-name">
                  {bill.icon ? `${bill.icon} ` : ""}
                  {bill.name}
                </p>
                <p className="bank-meta">
                  {bill.transactionCount} transaction
                  {bill.transactionCount === 1 ? "" : "s"} this month
                  {bill.isEssential ? " · essential" : " · flexible"}
                </p>
              </div>
              <p className="spending-category-amount">
                {formatMoney(bill.spentThisMonth)}
              </p>
              <Link
                href={`/spending/${bill.categoryId}${suffix}`}
                className="btn btn-secondary"
              >
                Transactions
              </Link>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void toggleEssential(bill)}
              >
                {bill.isEssential ? "Not essential" : "Mark essential"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void remove(bill.id)}
              >
                Unmark
              </button>
            </div>
          ))
        )}
      </div>

      {suggestions.length > 0 ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h2 className="section-title">Seen often in the last 90 days</h2>
          <p className="bank-meta" style={{ marginBottom: "0.5rem" }}>
            If these are really bills, add a category and recategorise the
            transactions.
          </p>
          {suggestions.map((row) => (
            <div key={row.payeeMatch} className="spending-category-row">
              <div>
                <p className="spending-category-name">{row.name}</p>
                <p className="bank-meta">
                  {row.count} times · avg {formatMoney(row.typicalAmount)}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void create(row.name, true)}
              >
                Make bill category
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
