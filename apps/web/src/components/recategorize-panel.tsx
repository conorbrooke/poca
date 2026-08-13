"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiUpload, apiUrl } from "../lib/api";
import { formatMoney } from "../lib/format";
import type {
  CategoryOption,
  ReceiptSummary,
  SpendingTransaction,
  TagOption,
  TransactionDetail,
} from "../lib/types";

type RecategorizePanelProps = {
  transaction: SpendingTransaction;
  categories: CategoryOption[];
  onClose: () => void;
  onSaved: () => void;
};

type SplitDraft = {
  key: string;
  amount: string;
  categoryId: string;
  payeeLabel: string;
  tagIds: string[];
};

export function RecategorizePanel({
  transaction,
  categories,
  onClose,
  onSaved,
}: RecategorizePanelProps) {
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [tags, setTags] = useState<TagOption[]>([]);
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
  const [newCategoryIcon, setNewCategoryIcon] = useState("");
  const [categoryMode, setCategoryMode] = useState<"existing" | "new">(
    "existing",
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    transaction.tags.map((tag) => tag.id),
  );
  const [newTagName, setNewTagName] = useState("");
  const [rememberFuture, setRememberFuture] = useState(false);
  const [applyToSimilar, setApplyToSimilar] = useState(false);
  const [splitDrafts, setSplitDrafts] = useState<SplitDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const isSplitChild = transaction.kind === "split";
  const parentIsSplit = detail?.isSplit ?? transaction.isSplit;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [tx, tagList] = await Promise.all([
          apiFetch<TransactionDetail>(
            `/spending/transactions/${transaction.transactionId}`,
          ),
          apiFetch<TagOption[]>("/spending/tags"),
        ]);
        setDetail(tx);
        setTags(tagList);
        if (transaction.kind === "split") {
          const line = tx.splits.find((split) => split.id === transaction.splitId);
          if (line) {
            setDisplayName(line.payeeLabel);
            setCategoryId(line.categoryId);
            setSelectedTagIds(line.tags.map((tag) => tag.id));
          }
        } else {
          setDisplayName(tx.payeeLabel ?? tx.description.slice(0, 60));
          setSelectedTagIds(tx.tags.map((tag) => tag.id));
        }
        setSplitDrafts(
          tx.splits.length >= 2
            ? tx.splits.map((split) => ({
                key: split.id,
                amount: Math.abs(split.amount).toFixed(2),
                categoryId: split.categoryId,
                payeeLabel: split.payeeLabel,
                tagIds: split.tags.map((tag) => tag.id),
              }))
            : [
                {
                  key: "a",
                  amount: "",
                  categoryId:
                    categories.find((c) => c.name !== "Other")?.id ??
                    categories[0]?.id ??
                    "",
                  payeeLabel: tx.payeeLabel ?? tx.description.slice(0, 60),
                  tagIds: [],
                },
                {
                  key: "b",
                  amount: "",
                  categoryId:
                    categories.find((c) => c.name === "Other")?.id ??
                    categories[0]?.id ??
                    "",
                  payeeLabel: "Split remainder",
                  tagIds: [],
                },
              ],
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load transaction");
      }
    })();
  }, [transaction, categories]);

  const parentAmount = detail?.amount ?? transaction.amount;
  const splitTotal = splitDrafts.reduce(
    (sum, line) => sum + (Number.parseFloat(line.amount) || 0),
    0,
  );
  const remaining = Math.abs(parentAmount) - splitTotal;

  const defaultCategoryId = useMemo(
    () =>
      categories.find((c) => c.name !== "Other")?.id ?? categories[0]?.id ?? "",
    [categories],
  );

  async function resolveCategoryId() {
    if (!changeCategory && !isSplitChild) return undefined;
    if (categoryMode === "new") {
      const created = await apiFetch<CategoryOption>("/spending/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          ...(newCategoryIcon.trim() ? { icon: newCategoryIcon.trim() } : {}),
        }),
      });
      return created.id;
    }
    return categoryId;
  }

  async function handleSaveDetails() {
    setSaving(true);
    setError(null);
    try {
      const targetCategoryId = await resolveCategoryId();

      if (isSplitChild && transaction.splitId) {
        await apiFetch(`/spending/splits/${transaction.splitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payeeLabel: displayName.trim(),
            tagIds: selectedTagIds,
            ...(targetCategoryId || categoryId
              ? { categoryId: targetCategoryId ?? categoryId }
              : {}),
          }),
        });
      } else {
        await apiFetch(`/spending/transactions/${transaction.transactionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payeeLabel: displayName.trim(),
            createRule: rememberFuture,
            applyToSimilar,
            tagIds: selectedTagIds,
            ...(targetCategoryId ? { categoryId: targetCategoryId } : {}),
          }),
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSplits() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/spending/transactions/${transaction.transactionId}/splits`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          splits: splitDrafts.map((line) => ({
            amount: Number.parseFloat(line.amount),
            categoryId: line.categoryId,
            payeeLabel: line.payeeLabel.trim(),
            tagIds: line.tagIds,
          })),
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save splits");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnsplit() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(
        `/spending/transactions/${transaction.transactionId}/splits`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: categoryId || defaultCategoryId,
            payeeLabel: displayName.trim(),
            tagIds: selectedTagIds,
          }),
        },
      );
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unsplit");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTag() {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const created = await apiFetch<TagOption>("/spending/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setTags((current) =>
        current.some((tag) => tag.id === created.id)
          ? current
          : [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSelectedTagIds((current) =>
        current.includes(created.id) ? current : [...current, created.id],
      );
      setNewTagName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create tag");
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const receipt = await apiUpload<ReceiptSummary>(
        `/spending/transactions/${transaction.transactionId}/receipts`,
        file,
      );
      setDetail((current) =>
        current
          ? { ...current, receipts: [...current.receipts, receipt] }
          : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload receipt");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteReceipt(receiptId: string) {
    try {
      await apiFetch(
        `/spending/transactions/${transaction.transactionId}/receipts/${receiptId}`,
        { method: "DELETE" },
      );
      setDetail((current) =>
        current
          ? {
              ...current,
              receipts: current.receipts.filter((item) => item.id !== receiptId),
            }
          : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete receipt");
    }
  }

  function toggleTag(tagId: string, current: string[], setter: (ids: string[]) => void) {
    setter(
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  }

  const hideParentCategory = parentIsSplit && !isSplitChild;

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
            <p className="page-eyebrow">
              {isSplitChild ? "Edit split line" : "Edit transaction"}
            </p>
            <h2 id="recategorize-title" className="section-title">
              {transaction.payeeLabel ?? transaction.description}
            </h2>
            <p className="bank-meta">
              {formatMoney(transaction.amount, transaction.currency, {
                signed: true,
              })}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {detail?.splitOutOfBalance ? (
          <p className="alert alert-warning">
            Splits no longer match the bank amount. Edit the split lines or
            unsplit this transaction.
          </p>
        ) : null}

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
          Bank description:{" "}
          <span style={{ opacity: 0.85 }}>{transaction.description}</span>
        </p>

        {!hideParentCategory ? (
          <>
            <div>
              <p className="login-label">Tags</p>
              <div className="tag-chip-row">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`tag-chip${selectedTagIds.includes(tag.id) ? " active" : ""}`}
                    onClick={() =>
                      toggleTag(tag.id, selectedTagIds, setSelectedTagIds)
                    }
                  >
                    <span
                      className="tag-chip-dot"
                      style={{ background: tag.color }}
                    />
                    {tag.icon ? `${tag.icon} ` : ""}
                    {tag.name}
                  </button>
                ))}
              </div>
              <div className="tag-chip-row" style={{ marginTop: "0.5rem" }}>
                <input
                  className="login-input"
                  value={newTagName}
                  onChange={(event) => setNewTagName(event.target.value)}
                  placeholder="New tag name"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void handleCreateTag()}
                >
                  Add tag
                </button>
              </div>
            </div>

            {!isSplitChild ? (
              <>
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
              </>
            ) : null}

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={changeCategory || isSplitChild}
                disabled={isSplitChild}
                onChange={(event) => setChangeCategory(event.target.checked)}
              />
              {isSplitChild ? "Category" : "Change category"}
            </label>

            {changeCategory || isSplitChild ? (
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
                  <>
                    <label className="login-label">
                      New category name
                      <input
                        className="login-input"
                        value={newCategoryName}
                        onChange={(event) => setNewCategoryName(event.target.value)}
                        placeholder="e.g. Pet care"
                      />
                    </label>
                    <label className="login-label">
                      Icon (one or two emojis)
                      <input
                        className="login-input"
                        value={newCategoryIcon}
                        onChange={(event) => setNewCategoryIcon(event.target.value)}
                        placeholder="🍽️ or ⛽🚗"
                      />
                    </label>
                  </>
                )}
              </>
            ) : null}

            <button
              type="button"
              className="btn btn-primary login-submit"
              disabled={
                saving ||
                !displayName.trim() ||
                ((changeCategory || isSplitChild) &&
                  categoryMode === "new" &&
                  !newCategoryName.trim())
              }
              onClick={() => void handleSaveDetails()}
            >
              {saving ? "Saving…" : "Save details"}
            </button>
          </>
        ) : null}

        <h3 className="section-title">Split transaction</h3>
        <p className="bank-meta">
          Break this bank transaction into smaller lines. Lines must add up to{" "}
          {formatMoney(Math.abs(parentAmount))}. Remaining:{" "}
          {formatMoney(remaining)}
        </p>
        {splitDrafts.map((line, index) => (
          <div key={line.key} className="split-line-card">
            <div className="split-line-header">
              <strong>Line {index + 1}</strong>
              {splitDrafts.length > 2 ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setSplitDrafts((current) =>
                      current.filter((item) => item.key !== line.key),
                    )
                  }
                >
                  Remove
                </button>
              ) : null}
            </div>
            <label className="login-label">
              Amount
              <input
                className="login-input"
                type="number"
                min="0.01"
                step="0.01"
                value={line.amount}
                onChange={(event) =>
                  setSplitDrafts((current) =>
                    current.map((item) =>
                      item.key === line.key
                        ? { ...item, amount: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <label className="login-label">
              Display name
              <input
                className="login-input"
                value={line.payeeLabel}
                onChange={(event) =>
                  setSplitDrafts((current) =>
                    current.map((item) =>
                      item.key === line.key
                        ? { ...item, payeeLabel: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <label className="login-label">
              Category
              <select
                className="login-input"
                value={line.categoryId}
                onChange={(event) =>
                  setSplitDrafts((current) =>
                    current.map((item) =>
                      item.key === line.key
                        ? { ...item, categoryId: event.target.value }
                        : item,
                    ),
                  )
                }
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon ? `${category.icon} ` : ""}
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="tag-chip-row">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-chip${line.tagIds.includes(tag.id) ? " active" : ""}`}
                  onClick={() =>
                    setSplitDrafts((current) =>
                      current.map((item) =>
                        item.key === line.key
                          ? {
                              ...item,
                              tagIds: item.tagIds.includes(tag.id)
                                ? item.tagIds.filter((id) => id !== tag.id)
                                : [...item.tagIds, tag.id],
                            }
                          : item,
                      ),
                    )
                  }
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            setSplitDrafts((current) => [
              ...current,
              {
                key: `${Date.now()}`,
                amount: remaining > 0 ? remaining.toFixed(2) : "",
                categoryId: defaultCategoryId,
                payeeLabel: "",
                tagIds: [],
              },
            ])
          }
        >
          Add split line
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={
            saving ||
            splitDrafts.length < 2 ||
            splitDrafts.some((line) => !line.payeeLabel.trim() || !line.amount)
          }
          onClick={() => void handleSaveSplits()}
        >
          Save splits
        </button>
        {parentIsSplit ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving}
            onClick={() => void handleUnsplit()}
          >
            Unsplit into one transaction
          </button>
        ) : null}

        <h3 className="section-title">Receipts</h3>
        <p className="bank-meta">
          Attached to the original bank transaction
          {parentIsSplit ? " and visible on every split line" : ""}.
        </p>
        <div className="receipt-list">
          {(detail?.receipts ?? []).map((receipt) => (
            <div key={receipt.id} className="receipt-row">
              <a
                href={apiUrl(
                  `/spending/transactions/${transaction.transactionId}/receipts/${receipt.id}`,
                )}
                target="_blank"
                rel="noreferrer"
              >
                {receipt.storedName}
              </a>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void handleDeleteReceipt(receipt.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <label className="login-label">
          Upload receipt
          <input
            className="login-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
              event.target.value = "";
            }}
          />
        </label>

        {error ? <p className="alert alert-error">{error}</p> : null}
      </div>
    </div>
  );
}
