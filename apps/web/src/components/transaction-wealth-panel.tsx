"use client";

import { useEffect, useMemo, useState } from "react";
import {
  WEALTH_CLASSES,
  type TransactionWealthContext,
  type TransactionWealthItemOption,
} from "@poca/shared";
import { apiFetch } from "../lib/api";
import { formatDate } from "../lib/format";
import {
  LoanTermFields,
  emptyLoanTermDraft,
  loanTermsPayload,
  loanTermsValidationError,
} from "./loan-term-fields";

type LedgerRole = "PURCHASE" | "OPENING" | "REPAYMENT" | "INCREASE";

type TransactionWealthPanelProps = {
  transactionId: string;
  amount: number;
  payeeLabel: string | null;
  description: string;
  bookedAt: string;
};

const ASSET_CLASSES = WEALTH_CLASSES.filter(
  (cls) => !["MORTGAGE", "LOAN", "CREDIT_CARD", "PERSONAL", "PENSION"].includes(cls),
);
const LIABILITY_CLASSES = WEALTH_CLASSES.filter((cls) =>
  ["MORTGAGE", "LOAN", "CREDIT_CARD", "PERSONAL"].includes(cls),
);

function roleOptions(side: "ASSET" | "LIABILITY"): LedgerRole[] {
  return side === "ASSET" ? ["PURCHASE", "OPENING"] : ["REPAYMENT", "INCREASE"];
}

export function TransactionWealthPanel({
  transactionId,
  amount,
  payeeLabel,
  description,
  bookedAt,
}: TransactionWealthPanelProps) {
  const [context, setContext] = useState<TransactionWealthContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [side, setSide] = useState<"ASSET" | "LIABILITY">(
    amount < 0 ? "LIABILITY" : "ASSET",
  );
  const [itemId, setItemId] = useState("");
  const [role, setRole] = useState<LedgerRole>(amount < 0 ? "REPAYMENT" : "OPENING");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState(payeeLabel ?? description.slice(0, 60));
  const [newClass, setNewClass] = useState("LOAN");
  const [loanDraft, setLoanDraft] = useState(emptyLoanTermDraft);
  const [assetValue, setAssetValue] = useState("");
  const [busy, setBusy] = useState(false);

  const monthlyPaymentHint = amount < 0 ? Math.abs(amount) : null;

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const next = await apiFetch<TransactionWealthContext>(
        `/wealth/transactions/${transactionId}`,
      );
      setContext(next);
      if (next.attachment) {
        setSide(next.attachment.side);
        setRole(next.attachment.role);
        setItemId(next.attachment.itemId);
      } else {
        const nextSide = next.amount < 0 ? "LIABILITY" : "ASSET";
        setSide(nextSide);
        setRole(
          nextSide === "ASSET" ? next.defaults.assetRole : next.defaults.liabilityRole,
        );
        const first = next.items.find((item) => item.side === nextSide);
        setItemId(first?.id ?? "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load net worth link");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [transactionId]);

  const sideItems = useMemo(
    (): TransactionWealthItemOption[] =>
      context?.items.filter((item) => item.side === side) ?? [],
    [context, side],
  );

  useEffect(() => {
    if (!context?.attachment && sideItems.length > 0 && !sideItems.some((item) => item.id === itemId)) {
      setItemId(sideItems[0]?.id ?? "");
    }
  }, [context?.attachment, sideItems, itemId]);

  useEffect(() => {
    if (!context?.attachment) {
      setRole(
        side === "ASSET" ? context?.defaults.assetRole ?? "PURCHASE" : context?.defaults.liabilityRole ?? "REPAYMENT",
      );
      setNewClass(side === "ASSET" ? "OTHER" : "LOAN");
    }
  }, [side, context?.attachment, context?.defaults]);

  async function attach(existingItemId = itemId) {
    if (!existingItemId) return;
    setBusy(true);
    setError(null);
    setSavedMessage(null);
    try {
      await apiFetch(`/wealth/transactions/${transactionId}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: existingItemId, role }),
      });
      setSavedMessage("Linked to net worth.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach transaction");
    } finally {
      setBusy(false);
    }
  }

  async function detach() {
    setBusy(true);
    setError(null);
    setSavedMessage(null);
    try {
      await apiFetch(`/wealth/transactions/${transactionId}/ledger`, {
        method: "DELETE",
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not detach transaction");
    } finally {
      setBusy(false);
    }
  }

  async function createAndAttach() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    setSavedMessage(null);

    const validationError =
      side === "LIABILITY"
        ? loanTermsValidationError(newClass, loanDraft, monthlyPaymentHint)
        : assetValue.trim() === "" || Number(assetValue) <= 0
          ? "Enter an opening value for this asset."
          : null;
    if (validationError) {
      setError(validationError);
      setBusy(false);
      return;
    }

    try {
      const loanPayload =
        side === "LIABILITY"
          ? loanTermsPayload(newClass, loanDraft, monthlyPaymentHint)
          : { currentValue: Number(assetValue) };

      const created = await apiFetch<{ id: string }>("/wealth/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          side,
          class: newClass,
          openingAsOf: bookedAt.slice(0, 10),
          ...loanPayload,
        }),
      });
      await apiFetch(`/wealth/transactions/${transactionId}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: created.id, role }),
      });
      setCreating(false);
      setSavedMessage("Created and linked to net worth.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create item");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !context) {
    return <p className="bank-meta">Loading net worth link…</p>;
  }

  return (
    <div>
      <h3 className="section-title">Net worth</h3>
      <p className="bank-meta">
        Link this transaction to an asset purchase or a liability repayment.
      </p>

      {context?.attachment ? (
        <div className="spending-category-row">
          <div>
            <p className="spending-category-name">{context.attachment.itemName}</p>
            <p className="bank-meta">
              {context.attachment.side === "ASSET" ? "Asset" : "Liability"} ·{" "}
              {context.attachment.role.toLowerCase()}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void detach()}
          >
            Detach
          </button>
        </div>
      ) : (
        <>
          <div className="range-tabs">
            <button
              type="button"
              className={`range-tab${side === "ASSET" ? " active" : ""}`}
              onClick={() => setSide("ASSET")}
            >
              Asset
            </button>
            <button
              type="button"
              className={`range-tab${side === "LIABILITY" ? " active" : ""}`}
              onClick={() => setSide("LIABILITY")}
            >
              Liability
            </button>
          </div>

          {sideItems.length > 0 ? (
            <>
              <label className="login-label">
                Existing {side === "ASSET" ? "asset" : "liability"}
                <select
                  className="login-input"
                  value={itemId}
                  onChange={(event) => setItemId(event.target.value)}
                >
                  {sideItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="login-label">
                Role
                <select
                  className="login-input"
                  value={role}
                  onChange={(event) => setRole(event.target.value as LedgerRole)}
                >
                  {roleOptions(side).map((option) => (
                    <option key={option} value={option}>
                      {option === "PURCHASE"
                        ? "Purchase"
                        : option === "OPENING"
                          ? "Opening inflow"
                          : option === "REPAYMENT"
                            ? "Repayment"
                            : "Increase"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !itemId}
                onClick={() => void attach()}
              >
                Attach to item
              </button>
            </>
          ) : (
            <p className="bank-meta">
              No {side === "ASSET" ? "assets" : "liabilities"} yet — create one below.
            </p>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: "0.75rem" }}
            onClick={() => setCreating((open) => !open)}
          >
            {creating ? "Hide create form" : `Create new ${side === "ASSET" ? "asset" : "liability"}`}
          </button>

          {creating ? (
            <div style={{ marginTop: "0.75rem" }}>
              <label className="login-label">
                Name
                <input
                  className="login-input"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
              </label>
              <label className="login-label">
                Type
                <select
                  className="login-input"
                  value={newClass}
                  onChange={(event) => setNewClass(event.target.value)}
                >
                  {(side === "ASSET" ? ASSET_CLASSES : LIABILITY_CLASSES).map((cls) => (
                    <option key={cls} value={cls}>
                      {cls.replaceAll("_", " ").toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
              {side === "LIABILITY" ? (
                <LoanTermFields
                  wealthClass={newClass}
                  draft={loanDraft}
                  onChange={setLoanDraft}
                  openingAsOf={bookedAt.slice(0, 10)}
                  compact
                  monthlyPaymentHint={monthlyPaymentHint}
                />
              ) : (
                <label className="login-label">
                  Opening value (€)
                  <input
                    className="login-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={assetValue}
                    onChange={(event) => setAssetValue(event.target.value)}
                  />
                </label>
              )}
              <p className="bank-meta">
                Opening date {formatDate(bookedAt)} · role {role.toLowerCase()}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !newName.trim()}
                onClick={() => void createAndAttach()}
              >
                Create and attach
              </button>
            </div>
          ) : null}
        </>
      )}

      {savedMessage ? <p className="alert alert-warning">{savedMessage}</p> : null}
      {error ? <p className="alert alert-error">{error}</p> : null}
    </div>
  );
}
