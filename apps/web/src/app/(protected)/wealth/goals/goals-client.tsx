"use client";

import { useEffect, useState } from "react";
import { SAVINGS_GOAL_KIND_OPTIONS } from "@poca/shared";
import { apiFetch } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/format";

type Goal = {
  id: string;
  name: string;
  kind: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  suggestedEmergency: number | null;
  accountId: string | null;
  accountName: string | null;
};

type AccountOption = { id: string; name: string; currentBalance: number };

function kindLabel(kind: string) {
  return SAVINGS_GOAL_KIND_OPTIONS.find((item) => item.id === kind)?.label ?? kind;
}

export function GoalsClient() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [name, setName] = useState("Mortgage fund");
  const [kind, setKind] = useState("HOUSE");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [accountId, setAccountId] = useState("");
  const [addAmounts, setAddAmounts] = useState<Record<string, string>>({});
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
          currentAmount: Number(current || 0),
          accountId: accountId || null,
        }),
      });
      setTarget("");
      setCurrent("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save goal");
    }
  }

  async function addMoney(goal: Goal) {
    const amount = Number(addAmounts[goal.id] || 0);
    if (!(amount > 0)) return;
    setError(null);
    try {
      await apiFetch(`/wealth/goals/${goal.id}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      setAddAmounts((currentValue) => ({ ...currentValue, [goal.id]: "" }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add money");
    }
  }

  async function unlink(goal: Goal) {
    setError(null);
    try {
      await apiFetch(`/wealth/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: goal.name,
          kind: goal.kind,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          accountId: null,
        }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlink account");
    }
  }

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="section-title">Savings pots</h2>
        <p className="bank-meta" style={{ maxWidth: "62ch" }}>
          A mortgage fund is a savings goal, not the mortgage itself. You can
          type how much you have put aside, or link a dedicated savings account
          so the pot follows that balance after each sync. You do not have to
          connect an account.
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
          <input
            className="login-input"
            type="number"
            placeholder="Already saved €"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
          <select
            className="login-input"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">Track manually (no account)</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
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
              Add a Mortgage fund with a target, then tap Add money whenever you
              transfer into it — or link the savings account that holds it.
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
                      ? ` · follows ${goal.accountName}`
                      : " · manual"}
                    {goal.suggestedEmergency
                      ? ` · 3× bills would be ${formatMoney(goal.suggestedEmergency)}`
                      : ""}
                  </p>
                </div>
                <p className="spending-category-amount">
                  {formatMoney(goal.currentAmount)} / {formatMoney(goal.targetAmount)}
                </p>
              </div>
              {goal.accountId ? (
                <p className="bank-meta" style={{ marginTop: "0.5rem" }}>
                  Saved amount is this account’s balance. Transfer into it and
                  sync the bank, or unlink to log adds by hand.
                </p>
              ) : (
                <div className="tag-chip-row" style={{ marginTop: "0.75rem" }}>
                  <input
                    className="login-input"
                    type="number"
                    placeholder="Add €"
                    value={addAmounts[goal.id] ?? ""}
                    onChange={(event) =>
                      setAddAmounts((currentValue) => ({
                        ...currentValue,
                        [goal.id]: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void addMoney(goal)}
                  >
                    Add money
                  </button>
                </div>
              )}
              <div className="tag-chip-row" style={{ marginTop: "0.5rem" }}>
                {goal.accountId ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void unlink(goal)}
                  >
                    Unlink account
                  </button>
                ) : null}
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
