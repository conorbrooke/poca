"use client";

import { useState } from "react";
import { apiFetch } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import {
  parseTransactionSelectionKey,
  transactionSelectionKey,
} from "../lib/transaction-selection";
import type { CategoryOption, SpendingTransaction } from "../lib/types";
import { BulkEditPanel } from "./bulk-edit-panel";
import { RecategorizePanel } from "./recategorize-panel";

type SelectableTransactionListProps = {
  transactions: SpendingTransaction[];
  categories: CategoryOption[];
  onReload: () => void;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  hasMore?: boolean;
  subtitle?: (tx: SpendingTransaction) => string;
};

export function SelectableTransactionList({
  transactions,
  categories,
  onReload,
  onLoadMore,
  loadingMore = false,
  hasMore = false,
  subtitle,
}: SelectableTransactionListProps) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selectedTx, setSelectedTx] = useState<SpendingTransaction | null>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  function toggleKey(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedKeys(new Set(transactions.map(transactionSelectionKey)));
  }

  function clearSelection() {
    setSelectedKeys(new Set());
    setSelectMode(false);
  }

  async function handleBulkSave(input: {
    changeCategory: boolean;
    categoryId: string;
    changeTags: boolean;
    tagIds: string[];
    tagMode: "set" | "add";
  }) {
    const items = [...selectedKeys]
      .map(parseTransactionSelectionKey)
      .filter(Boolean) as Array<{ kind: "transaction" | "split"; id: string }>;

    await apiFetch("/spending/transactions/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        ...(input.changeCategory ? { categoryId: input.categoryId } : {}),
        ...(input.changeTags ? { tagIds: input.tagIds, tagMode: input.tagMode } : {}),
      }),
    });

    clearSelection();
    onReload();
  }

  const selectedCount = selectedKeys.size;

  return (
    <>
      <div className="section-title-row">
        <div className="tag-chip-row">
          <button
            type="button"
            className={`btn btn-secondary${selectMode ? " active" : ""}`}
            onClick={() => {
              if (selectMode) clearSelection();
              else setSelectMode(true);
            }}
          >
            {selectMode ? "Cancel selection" : "Select"}
          </button>
          {selectMode ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={selectAllVisible}
              >
                Select all on page
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedCount === 0}
                onClick={() => setShowBulkEdit(true)}
              >
                Edit {selectedCount > 0 ? selectedCount : ""}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="transaction-list">
        {transactions.map((tx) => {
          const key = transactionSelectionKey(tx);
          const isSelected = selectedKeys.has(key);
          const rowSubtitle =
            subtitle?.(tx) ??
            (tx.kind === "split"
              ? `Part of ${tx.description}`
              : tx.description);

          return (
            <div
              key={key}
              className={`transaction-row${selectMode ? " selectable" : " clickable"}${isSelected ? " selected" : ""}`}
            >
              {selectMode ? (
                <label className="transaction-select">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleKey(key)}
                  />
                </label>
              ) : null}
              <button
                type="button"
                className="transaction-row-body"
                onClick={() => {
                  if (selectMode) toggleKey(key);
                  else setSelectedTx(tx);
                }}
              >
                <div className="transaction-main">
                  <p className="transaction-title">
                    {tx.payeeLabel ?? tx.description}
                    {tx.kind === "split" ? (
                      <span className="split-badge">Split</span>
                    ) : null}
                  </p>
                  <p className="transaction-subtitle">{rowSubtitle}</p>
                  {tx.tags.length > 0 ? (
                    <div className="transaction-tags">
                      {tx.tags.map((tag) => (
                        <span key={tag.id} className="transaction-tag">
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="transaction-meta">
                    <span>{formatDate(tx.bookedAt)}</span>
                    <span>{tx.institutionName}</span>
                    {tx.receiptCount > 0 ? (
                      <span>
                        {tx.receiptCount} receipt
                        {tx.receiptCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {tx.splitOutOfBalance ? <span>Out of balance</span> : null}
                  </div>
                </div>
                <p className="transaction-amount expense">
                  {formatMoney(tx.amount, tx.currency, { signed: true })}
                </p>
              </button>
            </div>
          );
        })}
      </div>

      {hasMore && onLoadMore ? (
        <div className="load-more-row">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loadingMore}
            onClick={() => void onLoadMore()}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}

      {selectedTx ? (
        <RecategorizePanel
          transaction={selectedTx}
          categories={categories}
          onClose={() => setSelectedTx(null)}
          onSaved={onReload}
        />
      ) : null}

      {showBulkEdit ? (
        <BulkEditPanel
          selectedCount={selectedCount}
          categories={categories}
          onClose={() => setShowBulkEdit(false)}
          onSave={handleBulkSave}
        />
      ) : null}
    </>
  );
}
