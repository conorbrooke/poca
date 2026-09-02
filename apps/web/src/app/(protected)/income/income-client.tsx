"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SPENDING_RANGES, type CategoryKind } from "@poca/shared";
import { CategoryKindFields } from "../../../components/category-kind-fields";
import { SelectableTransactionList } from "../../../components/selectable-transaction-list";
import { apiFetch } from "../../../lib/api";
import { formatMoney } from "../../../lib/format";
import { useSpendingRange } from "../../../lib/spending-range";
import type {
  CategoryOption,
  SpendingCategorySummary,
  SpendingSummaryResponse,
  SpendingTransaction,
} from "../../../lib/types";

export function IncomeClient() {
  const searchParams = useSearchParams();
  const [range, setRange] = useSpendingRange(searchParams.get("range"));
  const [data, setData] = useState<SpendingSummaryResponse | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [transactions, setTransactions] = useState<SpendingTransaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("");
  const [newCategoryKind, setNewCategoryKind] = useState<CategoryKind>("INCOME");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const bankConnectionId = searchParams.get("bank") ?? undefined;

  const summaryParams = useCallback(() => {
    const params = new URLSearchParams({ range, flow: "in" });
    if (bankConnectionId) params.set("bankConnectionId", bankConnectionId);
    return params;
  }, [range, bankConnectionId]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = summaryParams();
      const [summary, categoryList] = await Promise.all([
        apiFetch<SpendingSummaryResponse>(
          `/spending/summary?${params.toString()}`,
        ),
        apiFetch<CategoryOption[]>("/spending/categories"),
      ]);
      setData(summary);
      setCategories(categoryList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load income");
    } finally {
      setLoading(false);
    }
  }, [summaryParams]);

  const loadTransactions = useCallback(async () => {
    setLoadingTransactions(true);
    setError(null);
    try {
      const params = summaryParams();
      params.set("limit", "50");
      const result = await apiFetch<{
        transactions: SpendingTransaction[];
        nextCursor: string | null;
      }>(`/spending/activity?${params.toString()}`);
      setTransactions(result.transactions);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load incoming transactions",
      );
    } finally {
      setLoadingTransactions(false);
    }
  }, [summaryParams]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const params = summaryParams();
      params.set("limit", "50");
      params.set("cursor", nextCursor);
      const result = await apiFetch<{
        transactions: SpendingTransaction[];
        nextCursor: string | null;
      }>(`/spending/activity?${params.toString()}`);
      setTransactions((current) => [...current, ...result.transactions]);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load more transactions",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function reload() {
    await Promise.all([loadSummary(), loadTransactions()]);
  }

  async function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreatingCategory(true);
    setError(null);
    try {
      await apiFetch<CategoryOption>("/spending/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          kind: newCategoryKind,
          ...(newCategoryIcon.trim() ? { icon: newCategoryIcon.trim() } : {}),
        }),
      });
      setNewCategoryName("");
      setNewCategoryIcon("");
      setNewCategoryKind("INCOME");
      await loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create category");
    } finally {
      setCreatingCategory(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        <p>Loading income…</p>
      </div>
    );
  }

  const incomeCategories = data?.categories ?? [];
  const reviewCategories = data?.reviewCategories ?? [];
  const unusedIncomeCategories = categories
    .filter(
      (category) =>
        category.kind === "INCOME" &&
        !incomeCategories.some((row) => row.id === category.id),
    )
    .map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      isSystem: category.isSystem,
      kind: category.kind,
      totalSpent: 0,
      transactionCount: 0,
      share: 0,
    }));
  const displayIncomeCategories = [
    ...incomeCategories,
    ...unusedIncomeCategories,
  ];
  const categoryHref = (categoryId: string) => {
    const params = new URLSearchParams({ range, flow: "in" });
    if (bankConnectionId) params.set("bank", bankConnectionId);
    return `/spending/${categoryId}?${params.toString()}`;
  };

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="spending-hero card">
        <div className="spending-hero-top">
          <div>
            <p className="page-eyebrow">Earned this period</p>
            <h2 className="spending-total income">
              {formatMoney(data?.totalSpent ?? 0)}
            </h2>
            <p className="bank-meta">
              {data?.transactionCount ?? 0} income transaction
              {(data?.transactionCount ?? 0) === 1 ? "" : "s"} ·{" "}
              {SPENDING_RANGES.find((item) => item.id === range)?.label ?? range}
              · transfers excluded
            </p>
          </div>
        </div>

        <div className="range-tabs">
          {SPENDING_RANGES.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`range-tab${range === option.id ? " active" : ""}`}
              onClick={() => setRange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {data?.transfersCategory && data.totalTransferred > 0 ? (
        <Link
          href={categoryHref(data.transfersCategory.id)}
          className="spending-movements-card card"
        >
          <div className="spending-movements-copy">
            <p className="page-eyebrow">Money in, not earned</p>
            <h3 className="spending-movements-total">
              {formatMoney(data.totalTransferred)}
            </h3>
            <p className="bank-meta">
              {data.transferTransactionCount} transfer
              {data.transferTransactionCount === 1 ? "" : "s"} · deposits,
              reimbursements, account top-ups
            </p>
          </div>
          <span className="spending-movements-icon">
            {data.transfersCategory.icon ?? "↔️"}
          </span>
        </Link>
      ) : null}

      {reviewCategories.length > 0 ? (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 className="section-title">Needs a category</h2>
          <p className="bank-meta" style={{ marginBottom: "0.75rem" }}>
            These inflows are still in a spending category. Open them and set
            an income type (Salary, Sales, Interest) or Transfers.
          </p>
          <div className="spending-category-list">
            {reviewCategories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                href={categoryHref(category.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <h2 className="section-title">Income categories</h2>
      <div className="spending-category-list">
        {displayIncomeCategories.length === 0 ? (
          <div className="empty-state card">
            <h3>No income categories yet</h3>
            <p>
              Add Salary, Sales, Interest, or any other earned-money category
              below, then recategorise incoming transactions into them.
            </p>
          </div>
        ) : (
          displayIncomeCategories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              href={categoryHref(category.id)}
            />
          ))
        )}
      </div>

      <form
        className="card"
        style={{ marginTop: "1rem", marginBottom: "1.5rem" }}
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreateCategory();
        }}
      >
        <h2 className="section-title">Add a category</h2>
        <p className="bank-meta" style={{ marginBottom: "0.75rem" }}>
          Sales, dividends, stock interest — anything earned gets type Income.
          Money moving between accounts is Transfer.
        </p>
        <label className="login-label">
          Name
          <input
            className="login-input"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="e.g. Sales or Dividends"
          />
        </label>
        <label className="login-label">
          Icon (optional)
          <input
            className="login-input"
            value={newCategoryIcon}
            onChange={(event) => setNewCategoryIcon(event.target.value)}
            placeholder="🏷️"
          />
        </label>
        <CategoryKindFields
          name="income-new-category-kind"
          value={newCategoryKind}
          onChange={setNewCategoryKind}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={creatingCategory || !newCategoryName.trim()}
          style={{ marginTop: "0.75rem" }}
        >
          {creatingCategory ? "Adding…" : "Add category"}
        </button>
      </form>

      <div className="section-title-row" style={{ marginTop: "2rem" }}>
        <h2 className="section-title">
          All incoming
          {loadingTransactions ? (
            <span className="bank-meta" style={{ marginLeft: "0.5rem" }}>
              Updating…
            </span>
          ) : null}
        </h2>
      </div>
      <SelectableTransactionList
        transactions={transactions}
        categories={categories}
        onReload={() => void reload()}
        onLoadMore={() => void loadMore()}
        loadingMore={loadingMore}
        hasMore={Boolean(nextCursor)}
      />
    </div>
  );
}

function CategoryRow({
  category,
  href,
}: {
  category: SpendingCategorySummary;
  href: string;
}) {
  return (
    <Link href={href} className="spending-category-row">
      <div className="spending-category-main">
        <span
          className="spending-category-icon"
          style={{ background: `${category.color}22` }}
        >
          {category.icon ?? "•"}
        </span>
        <div className="spending-category-copy">
          <p className="spending-category-name">{category.name}</p>
          <p className="bank-meta">
            {category.transactionCount} transaction
            {category.transactionCount === 1 ? "" : "s"}
            {category.share > 0 ? ` · ${category.share}%` : ""}
          </p>
        </div>
      </div>
      {category.share > 0 ? (
        <div className="spending-category-bar-wrap">
          <div
            className="spending-category-bar"
            style={{
              width: `${Math.max(category.share, 4)}%`,
              background: category.color,
            }}
          />
        </div>
      ) : null}
      <p className="spending-category-amount">
        {formatMoney(category.totalSpent)}
      </p>
    </Link>
  );
}
