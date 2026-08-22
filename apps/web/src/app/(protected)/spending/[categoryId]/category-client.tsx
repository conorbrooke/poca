"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SPENDING_RANGES } from "@poca/shared";
import { SelectableTransactionList } from "../../../../components/selectable-transaction-list";
import { apiFetch } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/format";
import { useSpendingRange } from "../../../../lib/spending-range";
import type {
  CategoryDetailResponse,
  CategoryOption,
  SpendingTransaction,
} from "../../../../lib/types";

type CategoryClientProps = {
  categoryId: string;
};

export function CategoryClient({ categoryId }: CategoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [range] = useSpendingRange(searchParams.get("range"));
  const bankConnectionId = searchParams.get("bank") ?? undefined;
  const payeeFilter = searchParams.get("payee") ?? undefined;
  const tagIds = searchParams.get("tagIds") ?? undefined;

  const [detail, setDetail] = useState<CategoryDetailResponse | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [transactions, setTransactions] = useState<SpendingTransaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [iconValue, setIconValue] = useState("");
  const [colorValue, setColorValue] = useState("#6366f1");
  const [savingCategory, setSavingCategory] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState(false);

  const metaParams = useCallback(() => {
    const params = new URLSearchParams({ range });
    if (bankConnectionId) params.set("bankConnectionId", bankConnectionId);
    if (tagIds) params.set("tagIds", tagIds);
    return params;
  }, [range, bankConnectionId, tagIds]);

  const transactionParams = useCallback(() => {
    const params = metaParams();
    if (payeeFilter) params.set("payeeLabel", payeeFilter);
    return params;
  }, [metaParams, payeeFilter]);

  function setPayeeFilter(nextPayee: string | null) {
    const params = new URLSearchParams({ range });
    if (bankConnectionId) params.set("bank", bankConnectionId);
    if (tagIds) params.set("tagIds", tagIds);
    if (nextPayee) params.set("payee", nextPayee);
    router.push(`/spending/${categoryId}?${params.toString()}`, { scroll: false });
  }

  const loadCategoryMeta = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = metaParams();
      const [detailRes, categoryList] = await Promise.all([
        apiFetch<CategoryDetailResponse>(
          `/spending/categories/${categoryId}?${params.toString()}`,
        ),
        apiFetch<CategoryOption[]>("/spending/categories"),
      ]);
      setDetail(detailRes);
      setNameValue(detailRes.category.name);
      setIconValue(detailRes.category.icon ?? "");
      setColorValue(detailRes.category.color);
      setCategories(categoryList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load category");
    } finally {
      setLoading(false);
    }
  }, [categoryId, metaParams]);

  const loadTransactions = useCallback(async () => {
    setLoadingTransactions(true);
    setError(null);
    try {
      const params = transactionParams();
      const txRes = await apiFetch<{
        transactions: SpendingTransaction[];
        nextCursor: string | null;
      }>(
        `/spending/categories/${categoryId}/transactions?${params.toString()}&limit=50`,
      );
      setTransactions(txRes.transactions);
      setNextCursor(txRes.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setLoadingTransactions(false);
    }
  }, [categoryId, transactionParams]);

  const loadData = useCallback(async () => {
    await Promise.all([loadCategoryMeta(), loadTransactions()]);
  }, [loadCategoryMeta, loadTransactions]);

  useEffect(() => {
    void loadCategoryMeta();
  }, [loadCategoryMeta]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = transactionParams();
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

  async function saveCategory() {
    setSavingCategory(true);
    setError(null);
    try {
      await apiFetch(`/spending/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameValue.trim(),
          icon: iconValue.trim() || null,
          color: colorValue,
        }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update category");
    } finally {
      setSavingCategory(false);
    }
  }

  async function deleteCategory() {
    if (
      !window.confirm(
        "Delete this category? All its transactions and split lines will move to Other.",
      )
    ) {
      return;
    }

    setDeletingCategory(true);
    setError(null);
    try {
      await apiFetch(`/spending/categories/${categoryId}`, {
        method: "DELETE",
      });
      router.push(
        `/spending?${new URLSearchParams({
          range,
          ...(bankConnectionId ? { bank: bankConnectionId } : {}),
        }).toString()}`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete category");
    } finally {
      setDeletingCategory(false);
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

  const backParams = new URLSearchParams({ range });
  if (bankConnectionId) backParams.set("bank", bankConnectionId);
  const backHref = `/spending?${backParams.toString()}`;

  const isSystemCategory = detail.category.isSystem;

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
            style={{ background: `${colorValue}22` }}
          >
            {iconValue || detail.category.icon || "•"}
          </span>
          <div>
            <h2 className="spending-total">{nameValue || detail.category.name}</h2>
            <p className="bank-meta">
              {formatMoney(detail.totalSpent)} · {detail.transactionCount}{" "}
              transactions ·{" "}
              {SPENDING_RANGES.find((r) => r.id === range)?.label ?? range}
            </p>
          </div>
        </div>
        <div className="category-edit-form">
          <label className="login-label">
            Name
            <input
              className="login-input"
              value={nameValue}
              onChange={(event) => setNameValue(event.target.value)}
              disabled={isSystemCategory}
            />
          </label>
          <label className="login-label">
            Icon (one or two emojis)
            <input
              className="login-input"
              value={iconValue}
              onChange={(event) => setIconValue(event.target.value)}
              placeholder="⛽ or ⛽🚗"
            />
          </label>
          <label className="login-label">
            Colour
            <div className="tag-chip-row">
              <input
                className="login-input"
                type="color"
                value={colorValue}
                onChange={(event) => setColorValue(event.target.value)}
                style={{ width: "4rem", padding: "0.25rem" }}
              />
              <input
                className="login-input"
                value={colorValue}
                onChange={(event) => setColorValue(event.target.value)}
                placeholder="#6366f1"
              />
            </div>
          </label>
          <div className="tag-chip-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingCategory || !nameValue.trim()}
              onClick={() => void saveCategory()}
            >
              {savingCategory ? "Saving…" : "Save category"}
            </button>
            {!isSystemCategory ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={deletingCategory}
                onClick={() => void deleteCategory()}
              >
                {deletingCategory ? "Deleting…" : "Delete category"}
              </button>
            ) : null}
          </div>
          {isSystemCategory ? (
            <p className="bank-meta">
              Other is a system category — you can change its icon and colour, but
              not its name or delete it.
            </p>
          ) : (
            <p className="bank-meta">
              Deleting moves all transactions and split lines in this category to
              Other.
            </p>
          )}
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
            const active = payeeFilter === payee.payeeLabel;
            return (
              <button
                key={payee.payeeLabel}
                type="button"
                className={`payee-row${active ? " active" : ""}`}
                onClick={() =>
                  setPayeeFilter(active ? null : payee.payeeLabel)
                }
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
              </button>
            );
          })
        )}
      </div>

      <div className="section-title-row">
        <h2 className="section-title">
          {payeeFilter ? `${payeeFilter} transactions` : "All transactions"}
          {loadingTransactions ? (
            <span className="bank-meta" style={{ marginLeft: "0.5rem" }}>
              Updating…
            </span>
          ) : null}
        </h2>
        {payeeFilter ? (
          <button
            type="button"
            className="bank-meta link-button"
            onClick={() => setPayeeFilter(null)}
          >
            Clear merchant filter
          </button>
        ) : null}
      </div>

      <SelectableTransactionList
        transactions={transactions}
        categories={categories}
        onReload={() => void loadData()}
        onLoadMore={() => void loadMore()}
        loadingMore={loadingMore}
        hasMore={Boolean(nextCursor)}
      />
    </div>
  );
}
