"use client";

import { useEffect, useState } from "react";
import { isLoanWealthClass, WEALTH_CLASSES, WEALTH_SIDES } from "@poca/shared";
import { LineChart } from "../../../../components/line-chart";
import {
  LoanTermFields,
  emptyLoanTermDraft,
  formatLoanTermsSummary,
  itemToLoanDraft,
  loanTermsPayload,
  loanTermsValidationError,
} from "../../../../components/loan-term-fields";
import { LoanOfferSummaryView } from "../../../../components/loan-offer-summary";
import { apiFetch } from "../../../../lib/api";
import { formatDate, formatMoney } from "../../../../lib/format";

type Item = {
  id: string;
  name: string;
  side: "ASSET" | "LIABILITY";
  class: string;
  currentValue: number;
  estimated?: boolean;
  unverified?: boolean;
  accountId: string | null;
  accountName: string | null;
  interestRate: number | null;
  minimumPayment: number | null;
  depreciationPercentYearly: number | null;
  notes: string | null;
  loanSummary?: {
    principal: number;
    totalCostOfCredit: number | null;
    totalRepaymentAmount: number | null;
    variableInterestRate: number | null;
    variableApr: number | null;
    monthlyPayment: number | null;
    termMonths: number | null;
  } | null;
  trail: Array<{
    transactionId: string;
    role: string;
    amount: number;
    bookedAt: string;
    description: string;
    payeeLabel: string | null;
  }>;
  valuations: Array<{ asOf: string; value: number; source: string }>;
  series: Array<{ date: string; value: number }>;
};

type NetWorth = {
  bankCash: number;
  assets: number;
  liabilities: number;
  netWorth: number;
  items: Item[];
};

type AccountOption = {
  id: string;
  name: string;
  currentBalance: number;
  accountType: string | null;
};

type Candidate = {
  transactionId: string;
  amount: number;
  bookedAt: string;
  description: string;
  payeeLabel: string | null;
  accountName: string;
};

export function NetWorthClient() {
  const [data, setData] = useState<NetWorth | null>(null);
  const [snapshots, setSnapshots] = useState<
    Array<{ asOf: string; netWorth: number }>
  >([]);
  const [debts, setDebts] = useState<
    Array<{ id: string; name: string; balance: number; interestRate: number | null }>
  >([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [order, setOrder] = useState<"avalanche" | "snowball">("avalanche");
  const [name, setName] = useState("");
  const [side, setSide] = useState<"ASSET" | "LIABILITY">("ASSET");
  const [cls, setCls] = useState("PROPERTY");
  const [value, setValue] = useState("");
  const [createLoanDraft, setCreateLoanDraft] = useState(emptyLoanTermDraft);
  const [createMinPayment, setCreateMinPayment] = useState("");
  const [accountId, setAccountId] = useState("");
  const [dep, setDep] = useState("");
  const [openingAsOf, setOpeningAsOf] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editDep, setEditDep] = useState("");
  const [editLoanDraft, setEditLoanDraft] = useState(emptyLoanTermDraft);
  const [editMinPayment, setEditMinPayment] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [valuationAmount, setValuationAmount] = useState("");
  const [valuationPercent, setValuationPercent] = useState("");
  const [ledgerRole, setLedgerRole] = useState<"PURCHASE" | "OPENING" | "REPAYMENT" | "INCREASE">(
    "REPAYMENT",
  );

  async function reload() {
    const [worth, snaps, debtList, accountList] = await Promise.all([
      apiFetch<NetWorth>("/wealth/net-worth"),
      apiFetch<Array<{ asOf: string; netWorth: number }>>("/wealth/net-worth/snapshots"),
      apiFetch<typeof debts>(`/wealth/debts?order=${order}`),
      apiFetch<AccountOption[]>("/wealth/accounts"),
    ]);
    setData(worth);
    setSnapshots(snaps);
    setDebts(debtList);
    setAccounts(accountList);
  }

  useEffect(() => {
    void reload().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load net worth");
    });
  }, [order]);

  async function create() {
    setError(null);
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    const monthlyPayment =
      createMinPayment.trim() === "" ? null : Number(createMinPayment);
    const loanError = isLoanWealthClass(cls)
      ? loanTermsValidationError(cls, createLoanDraft, monthlyPayment)
      : value.trim() === "" || Number(value) <= 0
        ? "Enter an opening value."
        : null;
    if (loanError) {
      setError(loanError);
      return;
    }
    try {
      const loanPayload = isLoanWealthClass(cls)
        ? loanTermsPayload(cls, createLoanDraft, monthlyPayment)
        : {
            currentValue: Number(value),
            depreciationPercentYearly: dep === "" ? null : Number(dep) / 100,
          };
      await apiFetch("/wealth/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          side,
          class: cls,
          accountId: accountId || null,
          openingAsOf: openingAsOf || new Date().toISOString().slice(0, 10),
          ...loanPayload,
        }),
      });
      setName("");
      setValue("");
      setCreateLoanDraft(emptyLoanTermDraft());
      setCreateMinPayment("");
      setDep("");
      setAccountId("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save item");
    }
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditValue(String(item.currentValue));
    setEditLoanDraft(itemToLoanDraft(item));
    setEditMinPayment(
      item.minimumPayment != null ? String(item.minimumPayment) : "",
    );
    setEditDep(
      item.depreciationPercentYearly != null
        ? String(item.depreciationPercentYearly * 100)
        : "",
    );
    setEditAccountId(item.accountId ?? "");
    setEditNotes(item.notes ?? "");
    setLedgerRole(item.side === "LIABILITY" ? "REPAYMENT" : "PURCHASE");
    void apiFetch<Candidate[]>(`/wealth/items/${item.id}/candidates`)
      .then(setCandidates)
      .catch(() => setCandidates([]));
  }

  async function saveEdit(item: Item) {
    setError(null);
    const monthlyPayment =
      editMinPayment.trim() === "" ? null : Number(editMinPayment);
    const loanError = isLoanWealthClass(item.class)
      ? loanTermsValidationError(item.class, editLoanDraft, monthlyPayment)
      : editValue.trim() === "" || Number(editValue) <= 0
        ? "Enter an opening value."
        : null;
    if (loanError) {
      setError(loanError);
      return;
    }
    try {
      const loanPayload = isLoanWealthClass(item.class)
        ? loanTermsPayload(item.class, editLoanDraft, monthlyPayment)
        : {
            currentValue: Number(editValue),
            depreciationPercentYearly: editDep === "" ? null : Number(editDep) / 100,
          };
      await apiFetch(`/wealth/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          side: item.side,
          class: item.class,
          accountId: editAccountId || null,
          notes: editNotes || null,
          ...loanPayload,
        }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update item");
    }
  }

  const editing = data?.items.find((item) => item.id === editingId) ?? null;
  const loanAccounts = accounts.filter(
    (account) => (account.accountType ?? "").toUpperCase() === "LOAN",
  );

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
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="section-title">Add asset or liability</h2>
        <p className="bank-meta" style={{ marginBottom: "0.75rem", maxWidth: "62ch" }}>
          Opening snapshot is allowed if the purchase is not in Póca. Link a BOI
          loan account when it appears on reconnect; otherwise enter APR and
          attach the €205 transfers as repayments.
        </p>
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
            type="date"
            value={openingAsOf}
            onChange={(event) => setOpeningAsOf(event.target.value)}
            aria-label="Opening date"
          />
          {loanAccounts.length > 0 ? (
            <select
              className="login-input"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">No linked loan account</option>
              {loanAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({formatMoney(account.currentBalance)})
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={() => void create()}>
            Add
          </button>
        </div>
        {isLoanWealthClass(cls) ? (
          <>
            <LoanTermFields
              wealthClass={cls}
              draft={createLoanDraft}
              onChange={setCreateLoanDraft}
              openingAsOf={openingAsOf}
              monthlyPaymentHint={
                createMinPayment.trim() === "" ? null : Number(createMinPayment)
              }
            />
            <label className="login-label">
              Monthly repayment (€)
              <input
                className="login-input"
                type="number"
                min="0"
                step="0.01"
                value={createMinPayment}
                onChange={(event) => setCreateMinPayment(event.target.value)}
                placeholder="e.g. 205"
              />
            </label>
          </>
        ) : (
          <div className="tag-chip-row" style={{ marginTop: "0.75rem" }}>
            <input
              className="login-input"
              type="number"
              placeholder="Opening €"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <input
              className="login-input"
              type="number"
              placeholder="Car dep. % / year"
              value={dep}
              onChange={(event) => setDep(event.target.value)}
            />
          </div>
        )}
      </div>
      <div className="spending-category-list">
        {(data?.items ?? []).map((item) => (
          <div key={item.id} className="card" style={{ marginBottom: "0.75rem" }}>
            <div className="spending-category-row" style={{ border: "none", padding: 0 }}>
              <div>
                <p className="spending-category-name">{item.name}</p>
                <p className="bank-meta">
                  {item.side.toLowerCase()} · {item.class.toLowerCase().replace("_", " ")}
                  {item.estimated ? " · estimated" : ""}
                  {item.unverified ? " · add opening snapshot or transactions" : ""}
                  {item.accountName ? ` · ${item.accountName}` : ""}
                </p>
                {formatLoanTermsSummary(item).map((line) => (
                  <p key={line} className="bank-meta">
                    {line}
                  </p>
                ))}
              </div>
              <p className="spending-category-amount">{formatMoney(item.currentValue)}</p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  editingId === item.id ? setEditingId(null) : startEdit(item)
                }
              >
                {editingId === item.id ? "Close" : "Edit"}
              </button>
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
            {item.series.length > 1 ? (
              <div style={{ marginTop: "0.75rem" }}>
                <LineChart
                  series={[
                    {
                      id: item.id,
                      label: item.name,
                      color: item.side === "LIABILITY" ? "var(--expense)" : "var(--accent)",
                      points: item.series,
                    },
                  ]}
                />
              </div>
            ) : null}
            {item.loanSummary ? (
              <LoanOfferSummaryView summary={item.loanSummary} compact />
            ) : null}
            {editing && editing.id === item.id ? (
              <div style={{ marginTop: "0.75rem" }}>
                <div className="tag-chip-row">
                  <input
                    className="login-input"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                  />
                  <select
                    className="login-input"
                    value={editAccountId}
                    onChange={(event) => setEditAccountId(event.target.value)}
                  >
                    <option value="">No linked account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void saveEdit(item)}
                  >
                    Save
                  </button>
                </div>
                {isLoanWealthClass(item.class) ? (
                  <>
                    <LoanTermFields
                      wealthClass={item.class}
                      draft={editLoanDraft}
                      onChange={setEditLoanDraft}
                      monthlyPaymentHint={
                        editMinPayment.trim() === "" ? null : Number(editMinPayment)
                      }
                    />
                    <label className="login-label">
                      Monthly repayment (€)
                      <input
                        className="login-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editMinPayment}
                        onChange={(event) => setEditMinPayment(event.target.value)}
                      />
                    </label>
                  </>
                ) : (
                  <div className="tag-chip-row" style={{ marginTop: "0.5rem" }}>
                    <input
                      className="login-input"
                      type="number"
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                    />
                    <input
                      className="login-input"
                      type="number"
                      placeholder="Dep % / year"
                      value={editDep}
                      onChange={(event) => setEditDep(event.target.value)}
                    />
                  </div>
                )}
                {item.side === "ASSET" ? (
                  <div className="tag-chip-row" style={{ marginTop: "0.5rem" }}>
                    <input
                      className="login-input"
                      type="number"
                      placeholder="€ change"
                      value={valuationAmount}
                      onChange={(event) => setValuationAmount(event.target.value)}
                    />
                    <input
                      className="login-input"
                      type="number"
                      placeholder="% change"
                      value={valuationPercent}
                      onChange={(event) => setValuationPercent(event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() =>
                        void apiFetch(`/wealth/items/${item.id}/valuations`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            asOf: new Date().toISOString().slice(0, 10),
                            amountChange:
                              valuationAmount === "" ? undefined : Number(valuationAmount),
                            percentChange:
                              valuationPercent === "" ? undefined : Number(valuationPercent),
                          }),
                        }).then(() => {
                          setValuationAmount("");
                          setValuationPercent("");
                          return reload();
                        })
                      }
                    >
                      Record valuation
                    </button>
                  </div>
                ) : null}
                <h3 className="section-title" style={{ marginTop: "1rem", fontSize: "0.95rem" }}>
                  Proof transactions
                </h3>
                {item.trail.length === 0 ? (
                  <p className="bank-meta">Nothing attached yet.</p>
                ) : (
                  item.trail.map((tx) => (
                    <div key={tx.transactionId} className="spending-category-row">
                      <div>
                        <p className="spending-category-name">
                          {tx.payeeLabel ?? tx.description}
                        </p>
                        <p className="bank-meta">
                          {formatDate(tx.bookedAt)} · {tx.role.toLowerCase()}
                        </p>
                      </div>
                      <p className="spending-category-amount">{formatMoney(tx.amount)}</p>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          void apiFetch(
                            `/wealth/items/${item.id}/ledger/${tx.transactionId}`,
                            { method: "DELETE" },
                          ).then(reload)
                        }
                      >
                        Detach
                      </button>
                    </div>
                  ))
                )}
                <div className="tag-chip-row" style={{ marginTop: "0.5rem" }}>
                  <select
                    className="login-input"
                    value={ledgerRole}
                    onChange={(event) =>
                      setLedgerRole(event.target.value as typeof ledgerRole)
                    }
                  >
                    <option value="PURCHASE">Purchase</option>
                    <option value="OPENING">Opening inflow</option>
                    <option value="REPAYMENT">Repayment</option>
                    <option value="INCREASE">Increase</option>
                  </select>
                </div>
                {candidates.map((tx) => (
                  <div key={tx.transactionId} className="spending-category-row">
                    <div>
                      <p className="spending-category-name">
                        {tx.payeeLabel ?? tx.description}
                      </p>
                      <p className="bank-meta">
                        {formatDate(tx.bookedAt)} · {tx.accountName}
                      </p>
                    </div>
                    <p className="spending-category-amount">{formatMoney(tx.amount)}</p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() =>
                        void apiFetch(`/wealth/items/${item.id}/ledger`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            transactionId: tx.transactionId,
                            role: ledgerRole,
                          }),
                        }).then(reload)
                      }
                    >
                      Attach
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
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
