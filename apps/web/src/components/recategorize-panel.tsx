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
    categoryId: string | null;
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
  const [displayName, setDisplayName] = useState(
    transaction.payeeLabel ?? transaction.description.slice(0, 60),
  );
  const [changeCategory, setChangeCategory] = useState(false);
  const [categoryId, setCategoryId] = useState(
    transaction.categoryId ??
      categories.find((c) => c.name !== "Other")?.id ??
      categories[0]?.id ??
      "",
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryMode, setCategoryMode] = useState<"existing" | "new">(
    "existing",
  );
  const [rememberFuture, setRememberFuture] = useState(false);
  const [applyToSimilar, setApplyToSimilar] = useState(false);
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
      let targetCategoryId: string | undefined;

      if (changeCategory) {
        if (categoryMode === "new") {
          const created = await apiFetch<CategoryOption>("/spending/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newCategoryName.trim() }),
          });
          targetCategoryId = created.id;
        } else {
          targetCategoryId = categoryId;
        }
      }

      await apiFetch(`/spending/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payeeLabel: displayName.trim(),
          createRule: rememberFuture,
          applyToSimilar,
          ...(targetCategoryId ? { categoryId: targetCategoryId } : {}),
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
            <p className="page-eyebrow">Edit transaction</p>
            <h2 id="recategorize-title" className="section-title">
              {transaction.payeeLabel ?? transaction.description}
            </h2>
            <p className="bank-meta">
              {formatMoney(transaction.amount, "EUR", { signed: true })}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="login-label">
          Display name
          <input
            className="login-input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="How this should appear in your spending"
          />
        </label>
        <p className="bank-meta" style={{ marginTop: "-0.75rem" }}>
          Bank description (used for matching, not shown in reports):{" "}
          <span style={{ opacity: 0.85 }}>{transaction.description}</span>
        </p>

        <fieldset className="scope-fieldset">
          <legend className="login-label">Apply to</legend>
          <label className="radio-label">
            <input
              type="radio"
              name="scope"
              checked={!rememberFuture}
              onChange={() => setRememberFuture(false)}
            />
            This transaction only
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="scope"
              checked={rememberFuture}
              onChange={() => setRememberFuture(true)}
            />
            Remember for future matching transactions
          </label>
        </fieldset>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={applyToSimilar}
            onChange={(event) => setApplyToSimilar(event.target.checked)}
          />
          Also update similar past transactions
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={changeCategory}
            onChange={(event) => setChangeCategory(event.target.checked)}
          />
          Change category
        </label>

        {changeCategory ? (
          <>
            <div className="modal-tabs">
              <button
                type="button"
                className={`range-tab${categoryMode === "existing" ? " active" : ""}`}
                onClick={() => setCategoryMode("existing")}
              >
                Existing category
              </button>
              <button
                type="button"
                className={`range-tab${categoryMode === "new" ? " active" : ""}`}
                onClick={() => setCategoryMode("new")}
              >
                New category
              </button>
            </div>

            {categoryMode === "existing" ? (
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
          </>
        ) : null}

        {error ? <p className="alert alert-error">{error}</p> : null}

        <button
          type="button"
          className="btn btn-primary login-submit"
          disabled={
            saving ||
            !displayName.trim() ||
            (changeCategory &&
              categoryMode === "new" &&
              !newCategoryName.trim())
          }
          onClick={() => void handleSave()}
        >
          {saving ? (
            <>
              <span className="loading-spinner" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </button>
      </div>
    </div>
  );
}
