"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IRISH_WEALTH_NOTES,
  MYFUTUREFUND_2026,
  PENSION_KIND_OPTIONS,
  myFutureFundMonthlyFromGross,
} from "@poca/shared";
import { apiFetch } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/format";

type Pension = {
  id: string;
  name: string;
  currentValue: number;
  pensionKind: string | null;
  employeeContributionMonthly: number | null;
  employerContributionMonthly: number | null;
  stateContributionMonthly: number | null;
  monthlyInflow: number;
};

export function PensionClient() {
  const [items, setItems] = useState<Pension[]>([]);
  const [name, setName] = useState("MyFutureFund");
  const [kind, setKind] = useState("MYFUTUREFUND");
  const [value, setValue] = useState("");
  const [gross, setGross] = useState("");
  const [employee, setEmployee] = useState("");
  const [employer, setEmployer] = useState("");
  const [stateTopUp, setStateTopUp] = useState("");
  const [error, setError] = useState<string | null>(null);

  const kindOption = PENSION_KIND_OPTIONS.find((item) => item.id === kind);

  const preview = useMemo(() => {
    const grossMonthly = Number(gross);
    if (kind === "MYFUTUREFUND" && grossMonthly > 0) {
      return myFutureFundMonthlyFromGross(grossMonthly);
    }
    return null;
  }, [gross, kind]);

  useEffect(() => {
    if (!preview) return;
    setEmployee(String(preview.employee));
    setEmployer(String(preview.employer));
    setStateTopUp(String(preview.state));
  }, [preview]);

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
          currentValue: Number(value) || 0,
          pensionKind: kind,
          employeeContributionMonthly: employee === "" ? null : Number(employee),
          employerContributionMonthly: employer === "" ? null : Number(employer),
          stateContributionMonthly: stateTopUp === "" ? null : Number(stateTopUp),
        }),
      });
      setValue("");
      setGross("");
      setEmployee("");
      setEmployer("");
      setStateTopUp("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save pension");
    }
  }

  const totalMonthly = items.reduce((sum, item) => sum + item.monthlyInflow, 0);
  const totalPots = items.reduce((sum, item) => sum + item.currentValue, 0);

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="section-title">Irish pension tracker</h2>
        <p className="bank-meta" style={{ maxWidth: "62ch" }}>
          {IRISH_WEALTH_NOTES.pension}{" "}
          <a href="https://myfuturefund.ie/" target="_blank" rel="noreferrer">
            myfuturefund.ie
          </a>
        </p>
        <p className="bank-meta" style={{ marginTop: "0.75rem" }}>
          Pots {formatMoney(totalPots)} · going in {formatMoney(totalMonthly)}/month
        </p>
      </div>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="section-title">Add a pot</h2>
        <p className="bank-meta" style={{ marginBottom: "0.75rem", maxWidth: "62ch" }}>
          {kindOption?.hint}
          {kind === "MYFUTUREFUND"
            ? ` 2026 rates: you ${(MYFUTUREFUND_2026.employeeRate * 100).toFixed(1)}%, employer ${(MYFUTUREFUND_2026.employerRate * 100).toFixed(1)}%, State ${(MYFUTUREFUND_2026.stateRate * 100).toFixed(1)}% of gross.`
            : ""}
        </p>
        <div className="tag-chip-row">
          <input
            className="login-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <select
            className="login-input"
            value={kind}
            onChange={(event) => {
              const next = event.target.value;
              setKind(next);
              if (next === "MYFUTUREFUND") setName("MyFutureFund");
            }}
          >
            {PENSION_KIND_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            className="login-input"
            type="number"
            placeholder="Current pot €"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        {kind === "MYFUTUREFUND" ? (
          <label className="login-label" style={{ marginTop: "0.75rem" }}>
            Monthly gross pay (optional — fills 2026 rates)
            <input
              className="login-input"
              type="number"
              placeholder="e.g. 3200"
              value={gross}
              onChange={(event) => setGross(event.target.value)}
            />
          </label>
        ) : null}
        <div className="tag-chip-row" style={{ marginTop: "0.75rem" }}>
          <input
            className="login-input"
            type="number"
            placeholder="You / month €"
            value={employee}
            onChange={(event) => setEmployee(event.target.value)}
          />
          <input
            className="login-input"
            type="number"
            placeholder="Employer / month €"
            value={employer}
            onChange={(event) => setEmployer(event.target.value)}
          />
          <input
            className="login-input"
            type="number"
            placeholder="State / month €"
            value={stateTopUp}
            onChange={(event) => setStateTopUp(event.target.value)}
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
                {PENSION_KIND_OPTIONS.find((option) => option.id === item.pensionKind)
                  ?.label ?? item.pensionKind ?? "Pension"}
                {item.monthlyInflow > 0
                  ? ` · ${formatMoney(item.monthlyInflow)}/month in`
                  : ""}
              </p>
              {item.employeeContributionMonthly ||
              item.employerContributionMonthly ||
              item.stateContributionMonthly ? (
                <p className="bank-meta">
                  You {formatMoney(item.employeeContributionMonthly ?? 0)} · employer{" "}
                  {formatMoney(item.employerContributionMonthly ?? 0)}
                  {item.stateContributionMonthly
                    ? ` · State ${formatMoney(item.stateContributionMonthly)}`
                    : ""}
                </p>
              ) : null}
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
