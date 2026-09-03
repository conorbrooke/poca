"use client";

import { useEffect, useState } from "react";
import { IRISH_WEALTH_NOTES, PENSION_KINDS } from "@poca/shared";
import { apiFetch } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/format";

type Pension = {
  id: string;
  name: string;
  currentValue: number;
  pensionKind: string | null;
  employerMatchAnnual: number | null;
};

export function PensionClient() {
  const [items, setItems] = useState<Pension[]>([]);
  const [name, setName] = useState("Occupational pension");
  const [kind, setKind] = useState("PRSA");
  const [value, setValue] = useState("");
  const [match, setMatch] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setItems(await apiFetch<Pension[]>("/wealth/pensions"));
  }

  useEffect(() => {
    void reload().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load pensions");
    });
  }, []);

  async function create() {
    setError(null);
    try {
      await apiFetch("/wealth/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          side: "ASSET",
          class: "PENSION",
          currentValue: Number(value),
          pensionKind: kind,
          employerMatchAnnual: match === "" ? null : Number(match),
        }),
      });
      setValue("");
      setMatch("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save pension");
    }
  }

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <p>{IRISH_WEALTH_NOTES.pension}</p>
      </div>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="section-title">Add a pot</h2>
        <div className="tag-chip-row">
          <input
            className="login-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <select
            className="login-input"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            {PENSION_KINDS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            className="login-input"
            type="number"
            placeholder="Current value €"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <input
            className="login-input"
            type="number"
            placeholder="Employer match / year €"
            value={match}
            onChange={(event) => setMatch(event.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={() => void create()}>
            Add
          </button>
        </div>
      </div>
      <div className="spending-category-list">
        {items.map((item) => (
          <div key={item.id} className="spending-category-row">
            <div>
              <p className="spending-category-name">{item.name}</p>
              <p className="bank-meta">
                {item.pensionKind ?? "Pension"}
                {item.employerMatchAnnual
                  ? ` · employer match ${formatMoney(item.employerMatchAnnual)}/year`
                  : ""}
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
    </div>
  );
}
