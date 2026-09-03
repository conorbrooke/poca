"use client";

import { useEffect, useState } from "react";
import { IRISH_BILL_PRESETS } from "@poca/shared";
import { apiFetch } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/format";

type Bill = {
  id: string;
  name: string;
  typicalAmount: number;
  cadence: string;
  isEssential: boolean;
  monthlyAmount: number;
  nextDue: string | null;
  payeeMatch: string | null;
};

export function BillsClient() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [suggestions, setSuggestions] = useState<
    Array<{ name: string; typicalAmount: number; payeeMatch: string; count: number }>
  >([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<"WEEKLY" | "MONTHLY" | "YEARLY">("MONTHLY");
  const [essential, setEssential] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [list, suggested] = await Promise.all([
      apiFetch<Bill[]>("/wealth/bills"),
      apiFetch<typeof suggestions>("/wealth/bills/suggestions"),
    ]);
    setBills(list);
    setSuggestions(suggested);
  }

  useEffect(() => {
    void reload().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load bills");
    });
  }, []);

  async function create() {
    setError(null);
    try {
      await apiFetch("/wealth/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          typicalAmount: Number(amount),
          cadence,
          isEssential: essential,
        }),
      });
      setName("");
      setAmount("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add bill");
    }
  }

  async function remove(id: string) {
    await apiFetch(`/wealth/bills/${id}`, { method: "DELETE" });
    await reload();
  }

  const essentialMonthly = bills
    .filter((bill) => bill.isEssential)
    .reduce((sum, bill) => sum + bill.monthlyAmount, 0);

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="section-title">Fixed Irish household costs</h2>
        <p className="bank-meta">
          Essential bills this month ≈ {formatMoney(essentialMonthly)}. Emergency
          fund target uses 3× this figure.
        </p>
        <div className="tag-chip-row" style={{ marginTop: "0.75rem" }}>
          {IRISH_BILL_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="tag-chip"
              onClick={() => {
                setName(preset.name);
                setCadence(preset.cadence);
                setEssential(preset.essential);
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>
        <div className="tag-chip-row" style={{ marginTop: "0.75rem" }}>
          <input
            className="login-input"
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="login-input"
            type="number"
            placeholder="Amount €"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <select
            className="login-input"
            value={cadence}
            onChange={(event) =>
              setCadence(event.target.value as typeof cadence)
            }
          >
            <option value="MONTHLY">Monthly</option>
            <option value="WEEKLY">Weekly</option>
            <option value="YEARLY">Yearly</option>
          </select>
          <label className="bank-meta">
            <input
              type="checkbox"
              checked={essential}
              onChange={(event) => setEssential(event.target.checked)}
            />{" "}
            Essential
          </label>
          <button type="button" className="btn btn-primary" onClick={() => void create()}>
            Add bill
          </button>
        </div>
      </div>

      <div className="spending-category-list">
        {bills.map((bill) => (
          <div key={bill.id} className="spending-category-row">
            <div>
              <p className="spending-category-name">{bill.name}</p>
              <p className="bank-meta">
                {bill.cadence.toLowerCase()} · {formatMoney(bill.monthlyAmount)}/month
                {bill.isEssential ? " · essential" : ""}
              </p>
            </div>
            <p className="spending-category-amount">{formatMoney(bill.typicalAmount)}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void remove(bill.id)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {suggestions.length > 0 ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h2 className="section-title">Seen often in the last 90 days</h2>
          <p className="bank-meta">Use these if they are really bills, not shopping.</p>
          {suggestions.map((row) => (
            <p key={row.payeeMatch} className="bank-meta">
              {row.name} · {row.count} times · avg {formatMoney(row.typicalAmount)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
