"use client";

import { useEffect, useState } from "react";
import { IRISH_WEALTH_NOTES, SAVINGS_GOAL_KINDS } from "@poca/shared";
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
  accountName: string | null;
};

type AccountOption = { id: string; name: string };

export function GoalsClient() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [name, setName] = useState("Emergency fund");
  const [kind, setKind] = useState("EMERGENCY");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [accountId, setAccountId] = useState("");
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

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <p className="bank-meta" style={{ marginBottom: "1rem" }}>
        {IRISH_WEALTH_NOTES.dirt}
      </p>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="section-title">New savings pot</h2>
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
            {SAVINGS_GOAL_KINDS.map((item) => (
              <option key={item} value={item}>
                {item.toLowerCase()}
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
            placeholder="Saved so far €"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
          <select
            className="login-input"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">No linked account</option>
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
        {goals.map((goal) => (
          <div key={goal.id} className="spending-category-row">
            <div>
              <p className="spending-category-name">{goal.name}</p>
              <p className="bank-meta">
                {goal.kind.toLowerCase()} · {goal.progress}%
                {goal.accountName ? ` · ${goal.accountName}` : ""}
                {goal.suggestedEmergency
                  ? ` · 3× bills would be ${formatMoney(goal.suggestedEmergency)}`
                  : ""}
              </p>
            </div>
            <p className="spending-category-amount">
              {formatMoney(goal.currentAmount)} / {formatMoney(goal.targetAmount)}
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                void apiFetch(`/wealth/goals/${goal.id}`, { method: "DELETE" }).then(
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
