"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { applySpendingPeriod, spendingPeriodLabel } from "@poca/shared";
import { PeriodPicker } from "../../../../../components/period-picker";
import { SelectableTransactionList } from "../../../../../components/selectable-transaction-list";
import { apiFetch } from "../../../../../lib/api";
import { formatMoney } from "../../../../../lib/format";
import { useSpendingPeriod } from "../../../../../lib/spending-period";
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
  const { period, setPeriod, queryString } = useSpendingPeriod();
  const bankConnectionId = searchParams.get("bank") ?? undefined;

  const [detail, setDetail] = useState<TagSummaryResponse | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [transactions, setTransactions] = useState<SpendingTransaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(queryString);
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
  }, [tagId, queryString, bankConnectionId]);

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

  const backParams = applySpendingPeriod(new URLSearchParams(), period);
  if (bankConnectionId) backParams.set("bank", bankConnectionId);
  const backHref = `/spending/tags?${backParams.toString()}`;

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
              transactions · {detail.periodLabel ?? spendingPeriodLabel(period)}
            </p>
          </div>
        </div>
        <PeriodPicker period={period} onChange={setPeriod} />
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
              href={`/spending/${category.id}?${applySpendingPeriod(new URLSearchParams(), period).toString()}&tagIds=${tagId}${bankConnectionId ? `&bank=${bankConnectionId}` : ""}`}
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
      <SelectableTransactionList
        transactions={transactions}
        categories={categories}
        onReload={() => void loadData()}
        subtitle={(tx) => tx.categoryName ?? "Uncategorized"}
      />

      {nextCursor ? (
        <p className="bank-meta">More transactions available — open a category for paging.</p>
      ) : null}
    </div>
  );
}
