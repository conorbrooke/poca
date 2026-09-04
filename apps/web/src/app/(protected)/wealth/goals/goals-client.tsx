"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SAVINGS_GOAL_KIND_OPTIONS } from "@poca/shared";
import { apiFetch } from "../../../../lib/api";
import { formatDate, formatMoney } from "../../../../lib/format";

type TrailTx = {
  id: string;
  transactionId: string;
  source: "account" | "assigned";
  amount: number;
  bookedAt: string;
  description: string;
  payeeLabel: string | null;
  accountName: string;
  categoryId: string | null;
  categoryName: string | null;
};

type Goal = {
  id: string;
  name: string;
  kind: string;
  targetAmount: number;
  targetDate: string | null;
  currentAmount: number;
  accountAmount: number;
  assignedAmount: number;
  progress: number;
  suggestedEmergency: number | null;
  accountId: string | null;
  accountName: string | null;
  notes: string | null;
  trail: TrailTx[];
};

type AccountOption = { id: string; name: string; currentBalance: number };

function kindLabel(kind: string) {
  return SAVINGS_GOAL_KIND_OPTIONS.find((item) => item.id === kind)?.label ?? kind;
}

function txHref(tx: TrailTx) {
  if (tx.categoryId) return `/spending/${tx.categoryId}`;
  return "/spending";
}

export function GoalsClient() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [name, setName] = useState("Mortgage fund");
  const [kind, setKind] = useState("HOUSE");
  const [target, setTarget] = useState("");
  const [accountId, setAccountId] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<TrailTx[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [goalList, accountList] = await Promise.all([
      apiFetch<Goal[]>("/wealth/goals"),
      apiFetch<AccountOption[]>("/wealth/accounts"),
    ]);
    setGoals(goalList);
    setAccounts(accountList);
  }

  useEffect(() => {
    void reload().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load goals");
    });
  }, []);

  async function create() {
    setError(null);
    try {
      await apiFetch("/wealth/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          kind,
          targetAmount: Number(target),
          accountId: accountId || null,
        }),
      });
      setTarget("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save goal");
    }
  }

  async function linkAccount(goal: Goal, nextAccountId: string) {
    setError(null);
    try {
      await apiFetch(`/wealth/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: goal.name,
          kind: goal.kind,
          targetAmount: goal.targetAmount,
          accountId: nextAccountId || null,
        }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update account");
    }
  }

  async function openAssign(goalId: string) {
    setError(null);
    setAssigningId(goalId);
    try {
      setCandidates(await apiFetch<TrailTx[]>(`/wealth/goals/${goalId}/candidates`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load transactions");
    }
  }

  async function assign(goalId: string, transactionId: string) {
    setError(null);
    try {
      await apiFetch(`/wealth/goals/${goalId}/funding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });
      await reload();
      setCandidates(await apiFetch<TrailTx[]>(`/wealth/goals/${goalId}/candidates`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign transaction");
    }
  }

  async function unassign(goalId: string, transactionId: string) {
    setError(null);
    try {
      await apiFetch(`/wealth/goals/${goalId}/funding/${transactionId}`, {
        method: "DELETE",
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove transaction");
    }
  }

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="section-title">Savings pots</h2>
        <p className="bank-meta" style={{ maxWidth: "62ch" }}>
          A pot only grows when real money moves: a transfer into a linked
          savings account, or a transaction you assign (ATM cash, and so on).
          There is no typed-in balance.
        </p>
      </div>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="section-title">New pot</h2>
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
              if (next === "HOUSE") setName("Mortgage fund");
              if (next === "EMERGENCY") setName("Emergency fund");
            }}
          >
            {SAVINGS_GOAL_KIND_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            className="login-input"
            type="number"
            placeholder="Target €"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
          <select
            className="login-input"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">No account yet — assign transactions</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({formatMoney(account.currentBalance)})
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" onClick={() => void create()}>
            Add goal
          </button>
        </div>
      </div>
      <div className="spending-category-list">
        {goals.length === 0 ? (
          <div className="empty-state card">
            <h3>No pots yet</h3>
            <p>
              Link a savings account, or create a pot and assign ATM / transfer
              transactions to it. The saved figure is those balances and
              transactions — nothing else.
            </p>
          </div>
        ) : (
          goals.map((goal) => (
            <div key={goal.id} className="card" style={{ marginBottom: "0.75rem" }}>
              <div className="spending-category-row" style={{ border: "none", padding: 0 }}>
                <div>
                  <p className="spending-category-name">{goal.name}</p>
                  <p className="bank-meta">
                    {kindLabel(goal.kind)} · {goal.progress}%
                    {goal.accountName
                      ? ` · ${goal.accountName} ${formatMoney(goal.accountAmount)}`
                      : ""}
                    {goal.assignedAmount > 0
                      ? ` · assigned ${formatMoney(goal.assignedAmount)}`
                      : ""}
                    {goal.suggestedEmergency
                      ? ` · 3× bills would be ${formatMoney(goal.suggestedEmergency)}`
                      : ""}
                  </p>
                </div>
                <p className="spending-category-amount">
                  {formatMoney(goal.currentAmount)} / {formatMoney(goal.targetAmount)}
                </p>
              </div>

              <label className="login-label" style={{ marginTop: "0.75rem" }}>
                Linked account
                <select
                  className="login-input"
                  value={goal.accountId ?? ""}
                  onChange={(event) => void linkAccount(goal, event.target.value)}
                >
                  <option value="">None — transactions only</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({formatMoney(account.currentBalance)})
                    </option>
                  ))}
                </select>
              </label>
              <form
                className="tag-chip-row"
                style={{ marginTop: "0.75rem" }}
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const formData = new FormData(form);
                  void apiFetch(`/wealth/goals/${goal.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: String(formData.get("name") || goal.name),
                      kind: String(formData.get("kind") || goal.kind),
                      targetAmount: Number(formData.get("target") || goal.targetAmount),
                      targetDate: String(formData.get("date") || "") || null,
                      accountId: goal.accountId,
                      notes: String(formData.get("notes") || "") || null,
                    }),
                  }).then(reload);
                }}
              >
                <input
                  className="login-input"
                  name="name"
                  defaultValue={goal.name}
                />
                <select
                  className="login-input"
                  name="kind"
                  defaultValue={goal.kind}
                >
                  {SAVINGS_GOAL_KIND_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <input
                  className="login-input"
                  name="target"
                  type="number"
                  defaultValue={goal.targetAmount}
                />
                <input
                  className="login-input"
                  name="date"
                  type="date"
                  defaultValue={goal.targetDate?.slice(0, 10) ?? ""}
                />
                <input
                  className="login-input"
                  name="notes"
                  placeholder="Notes"
                  defaultValue={goal.notes ?? ""}
                />
                <button type="submit" className="btn btn-secondary">
                  Save goal
                </button>
              </form>

              <h3 className="section-title" style={{ marginTop: "1rem", fontSize: "0.95rem" }}>
                Money trail
              </h3>
              {goal.trail.length === 0 ? (
                <p className="bank-meta">
                  {goal.accountId
                    ? "No inbound transactions on this account yet. Transfer in and sync."
                    : "Nothing assigned. Attach an ATM withdrawal or other transaction below."}
                </p>
              ) : (
                <div className="spending-category-list" style={{ marginTop: "0.35rem" }}>
                  {goal.trail.map((tx) => (
                    <div key={`${tx.source}-${tx.id}`} className="spending-category-row">
                      <div>
                        <p className="spending-category-name">
                          {tx.payeeLabel ?? tx.description}
                        </p>
                        <p className="bank-meta">
                          {formatDate(tx.bookedAt)} · {tx.accountName}
                          {tx.categoryName ? ` · ${tx.categoryName}` : ""}
                          {tx.source === "assigned" ? " · assigned" : " · in account"}
                        </p>
                      </div>
                      <p className="spending-category-amount">{formatMoney(tx.amount)}</p>
                      <Link href={txHref(tx)} className="btn btn-secondary">
                        Open
                      </Link>
                      {tx.source === "assigned" ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => void unassign(goal.id, tx.transactionId)}
                        >
                          Unassign
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <div className="tag-chip-row" style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    assigningId === goal.id
                      ? setAssigningId(null)
                      : void openAssign(goal.id)
                  }
                >
                  {assigningId === goal.id ? "Hide transactions" : "Assign a transaction"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    void apiFetch(`/wealth/goals/${goal.id}`, {
                      method: "DELETE",
                    }).then(reload)
                  }
                >
                  Remove
                </button>
              </div>

              {assigningId === goal.id ? (
                <div style={{ marginTop: "0.75rem" }}>
                  <p className="bank-meta" style={{ marginBottom: "0.5rem" }}>
                    Last 90 days, excluding money already in the linked account.
                    ATM withdrawals and transfers you want counted as cash toward
                    this pot go here.
                  </p>
                  {candidates.length === 0 ? (
                    <p className="bank-meta">No unassigned transactions in this window.</p>
                  ) : (
                    candidates.map((tx) => (
                      <div key={tx.id} className="spending-category-row">
                        <div>
                          <p className="spending-category-name">
                            {tx.payeeLabel ?? tx.description}
                          </p>
                          <p className="bank-meta">
                            {formatDate(tx.bookedAt)} · {tx.accountName}
                            {tx.categoryName ? ` · ${tx.categoryName}` : ""}
                          </p>
                        </div>
                        <p className="spending-category-amount">{formatMoney(tx.amount)}</p>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => void assign(goal.id, tx.transactionId)}
                        >
                          Assign
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
