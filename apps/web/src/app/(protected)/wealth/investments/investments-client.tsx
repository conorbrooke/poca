"use client";

import { useEffect, useState } from "react";
import { IRISH_BROKERS, IRISH_WEALTH_NOTES } from "@poca/shared";
import { apiFetch } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/format";

type Holding = {
  id: string;
  ticker: string;
  name: string;
  quantity: number;
  averageCost: number;
  lastPrice: number | null;
  marketValue: number;
  gain: number;
  broker: string | null;
};

export function InvestmentsClient() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [broker, setBroker] = useState("Revolut");
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setHoldings(await apiFetch<Holding[]>("/wealth/holdings"));
  }

  useEffect(() => {
    void reload().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load holdings");
    });
  }, []);

  async function create() {
    setError(null);
    try {
      await apiFetch("/wealth/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          name: name || ticker,
          quantity: Number(quantity),
          averageCost: Number(cost),
          lastPrice: price === "" ? null : Number(price),
          broker,
        }),
      });
      setTicker("");
      setName("");
      setQuantity("");
      setCost("");
      setPrice("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save holding");
    }
  }

  const total = holdings.reduce((sum, row) => sum + row.marketValue, 0);

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <p>{IRISH_WEALTH_NOTES.cgt}</p>
        <p className="bank-meta" style={{ marginTop: "0.5rem" }}>
          {IRISH_WEALTH_NOTES.funds}
        </p>
      </div>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="section-title">Manual holding</h2>
        <p className="bank-meta">No live prices — enter the last price you saw.</p>
        <div className="tag-chip-row" style={{ marginTop: "0.75rem" }}>
          <input
            className="login-input"
            placeholder="Ticker"
            value={ticker}
            onChange={(event) => setTicker(event.target.value)}
          />
          <input
            className="login-input"
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="login-input"
            type="number"
            placeholder="Qty"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <input
            className="login-input"
            type="number"
            placeholder="Avg cost"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
          />
          <input
            className="login-input"
            type="number"
            placeholder="Last price"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
          <select
            className="login-input"
            value={broker}
            onChange={(event) => setBroker(event.target.value)}
          >
            {IRISH_BROKERS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" onClick={() => void create()}>
            Add
          </button>
        </div>
      </div>
      <p className="bank-meta" style={{ marginBottom: "0.75rem" }}>
        Market value {formatMoney(total)}
      </p>
      <div className="spending-category-list">
        {holdings.map((row) => (
          <div key={row.id} className="spending-category-row">
            <div>
              <p className="spending-category-name">
                {row.ticker} · {row.name}
              </p>
              <p className="bank-meta">
                {row.quantity} × {formatMoney(row.lastPrice ?? row.averageCost)}
                {row.broker ? ` · ${row.broker}` : ""}
              </p>
            </div>
            <p className="spending-category-amount">
              {formatMoney(row.marketValue)}
              <span className="bank-meta" style={{ display: "block" }}>
                {formatMoney(row.gain, "EUR", { signed: true })}
              </span>
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                void apiFetch(`/wealth/holdings/${row.id}`, { method: "DELETE" }).then(
                  reload,
                )
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
