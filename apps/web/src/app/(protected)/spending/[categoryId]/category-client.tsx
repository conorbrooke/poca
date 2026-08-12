"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SPENDING_RANGES } from "@poca/shared";
import { RecategorizePanel } from "../../../../components/recategorize-panel";
import { apiFetch } from "../../../../lib/api";
import { formatDate, formatMoney } from "../../../../lib/format";
import type {
  CategoryDetailResponse,
  CategoryOption,
  SpendingTransaction,
} from "../../../../lib/types";

type CategoryClientProps = {
  categoryId: string;
};

export function CategoryClient({ categoryId }: CategoryClientProps) {
  const searchParams = useSearchParams();
  const range = searchParams.get("range") ?? "month";
  const bankConnectionId = searchParams.get("bank") ?? undefined;
  const payeeFilter = searchParams.get("payee") ?? undefined;

  const [detail, setDetail] = useState<CategoryDetailResponse | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [transactions, setTransactions] = useState<SpendingTransaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<SpendingTransaction | null>(null);

  const queryBase = useCallback(() => {
    const params = new URLSearchParams({ range });
    if (bankConnectionId) params.set("bankConnectionId", bankConnectionId);
    if (payeeFilter) params.set("payeeLabel", payeeFilter);
    return params;
  }, [range, bankConnectionId, payeeFilter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = queryBase();
      const [detailRes, categoryList, txRes] = await Promise.all([
        apiFetch<CategoryDetailResponse>(
          `/spending/categories/${categoryId}?${params.toString()}`,
        ),
        apiFetch<CategoryOption[]>("/spending/categories"),
        apiFetch<{ transactions: SpendingTransaction[]; nextCursor: string | null }>(
          `/spending/categories/${categoryId}/transactions?${params.toString()}&limit=50`,
        ),
      ]);
      setDetail(detailRes);
      setCategories(categoryList);
      setTransactions(txRes.transactions);
      setNextCursor(txRes.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load category");
    } finally {
      setLoading(false);
    }
  }, [categoryId, queryBase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = queryBase();
      params.set("cursor", nextCursor);
      params.set("limit", "50");
      const txRes = await apiFetch<{
        transactions: SpendingTransaction[];
        nextCursor: string | null;
      }>(`/spending/categories/${categoryId}/transactions?${params.toString()}`);
      setTransactions((current) => [...current, ...txRes.transactions]);
      setNextCursor(txRes.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading && !detail) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        <p>Loading category…</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="empty-state card">
        <h3>Category not found</h3>
        <p>{error ?? "Something went wrong."}</p>
      </div>
    );
  }

  const backHref = bankConnectionId
    ? `/spending?bank=${bankConnectionId}`
    : "/spending";

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <Link href={backHref} className="back-link">
        ← Back to spending
      </Link>

      <div
        className="spending-hero card"
        style={{ borderColor: `${detail.category.color}55` }}
      >
        <div className="spending-category-main">
          <span
            className="spending-category-icon large"
            style={{ background: `${detail.category.color}22` }}
          >
            {detail.category.icon ?? "•"}
          </span>
          <div>
            <h2 className="spending-total">{detail.category.name}</h2>
            <p className="bank-meta">
              {formatMoney(detail.totalSpent)} · {detail.transactionCount}{" "}
              transactions ·{" "}
              {SPENDING_RANGES.find((r) => r.id === range)?.label ?? range}
            </p>
          </div>
        </div>
      </div>

      <h2 className="section-title">Merchants</h2>
      <div className="payee-list">
        {detail.payees.length === 0 ? (
          <div className="empty-state card">
            <p>No merchants in this period.</p>
          </div>
        ) : (
          detail.payees.map((payee) => {
            const params = new URLSearchParams({ range, payee: payee.payeeLabel });
            if (bankConnectionId) params.set("bank", bankConnectionId);
            const active = payeeFilter === payee.payeeLabel;
            return (
              <Link
                key={payee.payeeLabel}
                href={`/spending/${categoryId}?${params.toString()}`}
                className={`payee-row${active ? " active" : ""}`}
              >
                <div>
                  <p className="payee-name">{payee.payeeLabel}</p>
                  <p className="bank-meta">
                    {payee.transactionCount} tx · {payee.share}%
                  </p>
                </div>
                <p className="spending-category-amount">
                  {formatMoney(payee.totalSpent)}
                </p>
              </Link>
            );
          })
        )}
      </div>

      <div className="section-title-row">
        <h2 className="section-title">
          {payeeFilter ? `${payeeFilter} transactions` : "All transactions"}
        </h2>
        {payeeFilter ? (
          <Link
            href={`/spending/${categoryId}?range=${range}${bankConnectionId ? `&bank=${bankConnectionId}` : ""}`}
            className="bank-meta"
          >
            Clear merchant filter
          </Link>
        ) : null}
      </div>

      <div className="transaction-list">
        {transactions.map((tx) => (
          <button
            key={tx.id}
            type="button"
            className="transaction-row clickable"
            onClick={() => setSelectedTx(tx)}
          >
            <div className="transaction-main">
              <p className="transaction-title">{tx.payeeLabel ?? tx.description}</p>
              <p className="transaction-subtitle">{tx.description}</p>
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
        <div className="load-more-row">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loadingMore}
            onClick={() => void loadMore()}
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
          onSaved={() => void loadData()}
        />
      ) : null}
    </div>
  );
}
