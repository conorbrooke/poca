"use client";

import { useEffect, useState } from "react";
import { WEALTH_CLASSES, WEALTH_SIDES } from "@poca/shared";
import { apiFetch } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/format";

type Item = {
  id: string;
  name: string;
  side: "ASSET" | "LIABILITY";
  class: string;
  currentValue: number;
  interestRate: number | null;
  minimumPayment: number | null;
};

type NetWorth = {
  bankCash: number;
  assets: number;
  liabilities: number;
  netWorth: number;
  items: Item[];
};

export function NetWorthClient() {
  const [data, setData] = useState<NetWorth | null>(null);
  const [snapshots, setSnapshots] = useState<
    Array<{ asOf: string; netWorth: number }>
  >([]);
  const [debts, setDebts] = useState<
    Array<{ id: string; name: string; balance: number; interestRate: number | null }>
  >([]);
  const [order, setOrder] = useState<"avalanche" | "snowball">("avalanche");
  const [name, setName] = useState("");
  const [side, setSide] = useState<"ASSET" | "LIABILITY">("ASSET");
  const [cls, setCls] = useState("PROPERTY");
  const [value, setValue] = useState("");
  const [rate, setRate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [worth, snaps, debtList] = await Promise.all([
      apiFetch<NetWorth>("/wealth/net-worth"),
      apiFetch<Array<{ asOf: string; netWorth: number }>>("/wealth/net-worth/snapshots"),
      apiFetch<typeof debts>(`/wealth/debts?order=${order}`),
    ]);
    setData(worth);
    setSnapshots(snaps);
    setDebts(debtList);
  }

  useEffect(() => {
    void reload().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load net worth");
    });
  }, [order]);

  async function create() {
    setError(null);
    try {
      await apiFetch("/wealth/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          side,
          class: cls,
          currentValue: Number(value),
          interestRate: rate === "" ? null : Number(rate) / 100,
        }),
      });
      setName("");
      setValue("");
      setRate("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save item");
    }
  }

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {data ? (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Net worth</span>
            <span className="stat-value">{formatMoney(data.netWorth)}</span>
            <span className="stat-hint">Includes bank cash not linked to an item</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Assets</span>
            <span className="stat-value income">{formatMoney(data.assets)}</span>
            <span className="stat-hint">Bank cash {formatMoney(data.bankCash)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Liabilities</span>
            <span className="stat-value expense">{formatMoney(data.liabilities)}</span>
          </div>
        </div>
      ) : null}
      <div className="tag-chip-row" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void apiFetch("/wealth/net-worth/snapshot", { method: "POST" }).then(reload)}
        >
          Save today’s snapshot
        </button>
      </div>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="section-title">Add asset or liability</h2>
        <div className="tag-chip-row">
          <input
            className="login-input"
            placeholder="Name (home, car, car loan…)"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <select
            className="login-input"
            value={side}
            onChange={(event) => {
              const next = event.target.value as typeof side;
              setSide(next);
              setCls(next === "LIABILITY" ? "LOAN" : "PROPERTY");
            }}
          >
            {WEALTH_SIDES.map((item) => (
              <option key={item} value={item}>
                {item.toLowerCase()}
              </option>
            ))}
          </select>
          <select
            className="login-input"
            value={cls}
            onChange={(event) => setCls(event.target.value)}
          >
            {WEALTH_CLASSES.map((item) => (
              <option key={item} value={item}>
                {item.toLowerCase().replace("_", " ")}
              </option>
            ))}
          </select>
          <input
            className="login-input"
            type="number"
            placeholder="Value €"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          {side === "LIABILITY" ? (
            <input
              className="login-input"
              type="number"
              placeholder="Rate %"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          ) : null}
          <button type="button" className="btn btn-primary" onClick={() => void create()}>
            Add
          </button>
        </div>
      </div>
      <div className="spending-category-list">
        {(data?.items ?? []).map((item) => (
          <div key={item.id} className="spending-category-row">
            <div>
              <p className="spending-category-name">{item.name}</p>
              <p className="bank-meta">
                {item.side.toLowerCase()} · {item.class.toLowerCase().replace("_", " ")}
                {item.interestRate != null ? ` · ${(item.interestRate * 100).toFixed(1)}%` : ""}
              </p>
            </div>
            <p className="spending-category-amount">{formatMoney(item.currentValue)}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                void apiFetch(`/wealth/items/${item.id}`, { method: "DELETE" }).then(reload)
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <h2 className="section-title" style={{ marginTop: "1.5rem" }}>
        Debt payoff order
      </h2>
      <div className="range-tabs">
        <button
          type="button"
          className={`range-tab${order === "avalanche" ? " active" : ""}`}
          onClick={() => setOrder("avalanche")}
        >
          Avalanche (highest rate)
        </button>
        <button
          type="button"
          className={`range-tab${order === "snowball" ? " active" : ""}`}
          onClick={() => setOrder("snowball")}
        >
          Snowball (smallest balance)
        </button>
      </div>
      {debts.map((debt) => (
        <p key={debt.id} className="bank-meta">
          {debt.name} · {formatMoney(debt.balance)}
          {debt.interestRate != null ? ` · ${(debt.interestRate * 100).toFixed(1)}%` : ""}
        </p>
      ))}
      {snapshots.length > 0 ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h2 className="section-title">Snapshots</h2>
          {snapshots.map((row) => (
            <p key={row.asOf} className="bank-meta">
              {row.asOf.slice(0, 10)} · {formatMoney(row.netWorth)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
