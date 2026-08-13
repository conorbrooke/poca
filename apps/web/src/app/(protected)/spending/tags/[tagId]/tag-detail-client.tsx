"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SPENDING_RANGES } from "@poca/shared";
import { RecategorizePanel } from "../../../../../components/recategorize-panel";
import { apiFetch } from "../../../../../lib/api";
import { formatDate, formatMoney } from "../../../../../lib/format";
import type {
  CategoryOption,
  SpendingTransaction,
  TagSummaryResponse,
} from "../../../../../lib/types";

type TagDetailClientProps = {
  tagId: string;
};

export function TagDetailClient({ tagId }: TagDetailClientProps) {
  const searchParams = useSearchParams();
  const range = searchParams.get("range") ?? "month";
  const bankConnectionId = searchParams.get("bank") ?? undefined;

  const [detail, setDetail] = useState<TagSummaryResponse | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [transactions, setTransactions] = useState<SpendingTransaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<SpendingTransaction | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range });
      if (bankConnectionId) params.set("bankConnectionId", bankConnectionId);
      const [summary, categoryList, txRes] = await Promise.all([
        apiFetch<TagSummaryResponse>(`/spending/tags/${tagId}?${params.toString()}`),
        apiFetch<CategoryOption[]>("/spending/categories"),
        apiFetch<{ transactions: SpendingTransaction[]; nextCursor: string | null }>(
          `/spending/tags/${tagId}/transactions?${params.toString()}&limit=50`,
        ),
      ]);
      setDetail(summary);
      setCategories(categoryList);
      setTransactions(txRes.transactions);
      setNextCursor(txRes.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tag");
    } finally {
      setLoading(false);
    }
  }, [tagId, range, bankConnectionId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading && !detail) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        <p>Loading tag…</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="empty-state card">
        <h3>Tag not found</h3>
        <p>{error ?? "Something went wrong."}</p>
      </div>
    );
  }

  const backHref = bankConnectionId
    ? `/spending/tags?bank=${bankConnectionId}`
    : "/spending/tags";

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <Link href={backHref} className="back-link">
        ← Back to tags
      </Link>

      <div
        className="spending-hero card"
        style={{ borderColor: `${detail.tag.color}55` }}
      >
        <div className="spending-category-main">
          <span
            className="spending-category-icon large"
            style={{ background: `${detail.tag.color}22` }}
          >
            {detail.tag.icon ?? "•"}
          </span>
          <div>
            <h2 className="spending-total">{detail.tag.name}</h2>
            <p className="bank-meta">
              {formatMoney(detail.totalSpent)} · {detail.transactionCount}{" "}
              transactions ·{" "}
              {SPENDING_RANGES.find((r) => r.id === range)?.label ?? range}
            </p>
          </div>
        </div>
      </div>

      <h2 className="section-title">By category</h2>
      <div className="payee-list">
        {detail.categories.length === 0 ? (
          <div className="empty-state card">
            <p>No tagged spending in this period.</p>
          </div>
        ) : (
          detail.categories.map((category) => (
            <Link
              key={category.id}
              href={`/spending/${category.id}?range=${range}&tagIds=${tagId}${bankConnectionId ? `&bank=${bankConnectionId}` : ""}`}
              className="payee-row"
            >
              <div>
                <p className="payee-name">
                  {category.icon ? `${category.icon} ` : ""}
                  {category.name}
                </p>
                <p className="bank-meta">
                  {category.transactionCount} tx · {category.share}%
                </p>
              </div>
              <p className="spending-category-amount">
                {formatMoney(category.totalSpent)}
              </p>
            </Link>
          ))
        )}
      </div>

      <h2 className="section-title">Transactions</h2>
      <div className="transaction-list">
        {transactions.map((tx) => (
          <button
            key={`${tx.kind}-${tx.id}`}
            type="button"
            className="transaction-row clickable"
            onClick={() => setSelectedTx(tx)}
          >
            <div className="transaction-main">
              <p className="transaction-title">
                {tx.payeeLabel ?? tx.description}
                {tx.kind === "split" ? (
                  <span className="split-badge">Split</span>
                ) : null}
              </p>
              <p className="transaction-subtitle">
                {tx.categoryName ?? "Uncategorized"}
              </p>
              <div className="transaction-meta">
                <span>{formatDate(tx.bookedAt)}</span>
                <span>{tx.institutionName}</span>
              </div>
            </div>
            <p className="transaction-amount expense">
              {formatMoney(tx.amount, tx.currency, { signed: true })}
            </p>
          </button>
        ))}
      </div>

      {nextCursor ? (
        <p className="bank-meta">More transactions available — open a category for paging.</p>
      ) : null}

      {selectedTx ? (
        <RecategorizePanel
          transaction={selectedTx}
          categories={categories}
          onClose={() => setSelectedTx(null)}
          onSaved={() => void loadData()}
        />
      ) : null}
    </div>
  );
}
