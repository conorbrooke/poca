"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { formatMoney } from "../lib/format";
import type { CategoryOption } from "../lib/types";

type RecategorizePanelProps = {
  transaction: {
    id: string;
    description: string;
    payeeLabel: string | null;
    amount: number;
  };
  categories: CategoryOption[];
  onClose: () => void;
  onSaved: () => void;
};

export function RecategorizePanel({
  transaction,
  categories,
  onClose,
  onSaved,
}: RecategorizePanelProps) {
  const [categoryId, setCategoryId] = useState(
    categories.find((c) => c.name !== "Other")?.id ?? categories[0]?.id ?? "",
  );
  const [payeeLabel, setPayeeLabel] = useState(
    transaction.payeeLabel ?? transaction.description.slice(0, 60),
  );
  const [createRule, setCreateRule] = useState(true);
  const [applyToSimilar, setApplyToSimilar] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let targetCategoryId = categoryId;

      if (mode === "new") {
        const created = await apiFetch<CategoryOption>("/spending/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newCategoryName.trim() }),
        });
        targetCategoryId = created.id;
      }

      await apiFetch(`/spending/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: targetCategoryId,
          payeeLabel: payeeLabel.trim(),
          createRule,
          applyToSimilar,
        }),
      });

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recategorize-title"
      >
        <div className="modal-header">
          <div>
            <p className="page-eyebrow">Categorize transaction</p>
            <h2 id="recategorize-title" className="section-title">
              {transaction.description}
            </h2>
            <p className="bank-meta">
              {formatMoney(transaction.amount, "EUR", { signed: true })}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-tabs">
          <button
            type="button"
            className={`range-tab${mode === "existing" ? " active" : ""}`}
            onClick={() => setMode("existing")}
          >
            Existing category
          </button>
          <button
            type="button"
            className={`range-tab${mode === "new" ? " active" : ""}`}
            onClick={() => setMode("new")}
          >
            New category
          </button>
        </div>

        {mode === "existing" ? (
          <label className="login-label">
            Category
            <select
              className="login-input"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon ? `${category.icon} ` : ""}
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="login-label">
            New category name
            <input
              className="login-input"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="e.g. Pet care"
            />
          </label>
        )}

        <label className="login-label">
          Payee / merchant label
          <input
            className="login-input"
            value={payeeLabel}
            onChange={(event) => setPayeeLabel(event.target.value)}
            placeholder="How this payee should appear in reports"
          />
        </label>

        <div className="checkbox-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={createRule}
              onChange={(event) => setCreateRule(event.target.checked)}
            />
            Remember this for future transactions
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={applyToSimilar}
              onChange={(event) => setApplyToSimilar(event.target.checked)}
            />
            Apply to similar past transactions
          </label>
        </div>

        {error ? <p className="alert alert-error">{error}</p> : null}

        <button
          type="button"
          className="btn btn-primary login-submit"
          disabled={
            saving ||
            !payeeLabel.trim() ||
            (mode === "new" && !newCategoryName.trim())
          }
          onClick={() => void handleSave()}
        >
          {saving ? (
            <>
              <span className="loading-spinner" />
              Saving…
            </>
          ) : (
            "Save categorization"
          )}
        </button>
      </div>
    </div>
  );
}
