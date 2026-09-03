"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { applySpendingPeriod, categoryKindLabel, spendingPeriodLabel, type CategoryKind } from "@poca/shared";
import { CategoryKindFields } from "../../../../components/category-kind-fields";
import { PeriodPicker } from "../../../../components/period-picker";
import { SelectableTransactionList } from "../../../../components/selectable-transaction-list";
import { TransferCategoryNav } from "../../../../components/transfers-section";
import { apiFetch } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/format";
import { useSpendingPeriod } from "../../../../lib/spending-period";
import type {
  CategoryDetailResponse,
  CategoryOption,
  SpendingCategorySummary,
  SpendingSummaryResponse,
  SpendingTransaction,
} from "../../../../lib/types";

type CategoryClientProps = {
  categoryId: string;
};

export function CategoryClient({ categoryId }: CategoryClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { period, setPeriod, queryString } = useSpendingPeriod();
  const bankConnectionId = searchParams.get("bank") ?? undefined;
  const payeeFilter = searchParams.get("payee") ?? undefined;
  const tagIds = searchParams.get("tagIds") ?? undefined;
  const isIncomeSection = pathname.startsWith("/income");
  const flow =
    searchParams.get("flow") === "in" ||
    (isIncomeSection && searchParams.get("flow") !== "out")
      ? "in"
      : "out";
  const categoryBase = isIncomeSection ? "/income" : "/spending";

  const [detail, setDetail] = useState<CategoryDetailResponse | null>(null);
  const [transferCategories, setTransferCategories] = useState<
    SpendingCategorySummary[]
  >([]);
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
  const [kindValue, setKindValue] = useState<CategoryKind>("EXPENSE");
  const [isBillValue, setIsBillValue] = useState(false);
  const [isEssentialValue, setIsEssentialValue] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState(false);

  const metaParams = useCallback(() => {
    const params = new URLSearchParams(queryString);
    params.set("flow", flow);
    if (bankConnectionId) params.set("bankConnectionId", bankConnectionId);
    if (tagIds) params.set("tagIds", tagIds);
    return params;
  }, [queryString, flow, bankConnectionId, tagIds]);

  const transactionParams = useCallback(() => {
    const params = metaParams();
    if (payeeFilter) params.set("payeeLabel", payeeFilter);
    return params;
  }, [metaParams, payeeFilter]);

  function setPayeeFilter(nextPayee: string | null) {
    const params = applySpendingPeriod(new URLSearchParams(), period);
    params.set("flow", flow);
    if (bankConnectionId) params.set("bank", bankConnectionId);
    if (tagIds) params.set("tagIds", tagIds);
    if (nextPayee) params.set("payee", nextPayee);
    router.push(`${categoryBase}/${categoryId}?${params.toString()}`, {
      scroll: false,
    });
  }

  const loadCategoryMeta = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = metaParams();
      const [detailRes, categoryList, summaryRes] = await Promise.all([
        apiFetch<CategoryDetailResponse>(
          `/spending/categories/${categoryId}?${params.toString()}`,
        ),
        apiFetch<CategoryOption[]>("/spending/categories"),
        apiFetch<SpendingSummaryResponse>(
          `/spending/summary?${params.toString()}`,
        ),
      ]);
      setDetail(detailRes);
      setTransferCategories(
        summaryRes.transferCategories ??
          (summaryRes.transfersCategory ? [summaryRes.transfersCategory] : []),
      );
      setNameValue(detailRes.category.name);
      setIconValue(detailRes.category.icon ?? "");
      setColorValue(detailRes.category.color);
      setKindValue(detailRes.category.kind);
      setIsBillValue(Boolean(detailRes.category.isBill));
      setIsEssentialValue(Boolean(detailRes.category.isEssential));
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
          kind: kindValue,
          isBill: kindValue === "EXPENSE" ? isBillValue : false,
          isEssential: kindValue === "EXPENSE" && isBillValue ? isEssentialValue : false,
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
        `${categoryBase}?${applySpendingPeriod(
          new URLSearchParams(bankConnectionId ? { bank: bankConnectionId } : {}),
          period,
        ).toString()}`,
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

  const backParams = applySpendingPeriod(new URLSearchParams(), period);
  if (bankConnectionId) backParams.set("bank", bankConnectionId);
  const backHref = `${categoryBase}?${backParams.toString()}`;

  const isSystemCategory = detail.category.isSystem;

  const isTransferCategory = detail?.category.kind === "TRANSFER";

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <Link href={backHref} className="back-link">
        {isIncomeSection ? "← Back to income" : "← Back to spending"}
      </Link>

      {isTransferCategory ? (
        <TransferCategoryNav
          transferCategories={transferCategories}
          activeCategoryId={categoryId}
          period={period}
          bankConnectionId={bankConnectionId}
          tagIds={tagIds?.split(",").filter(Boolean)}
          flow={flow}
          basePath={categoryBase}
        />
      ) : null}

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
            {isTransferCategory ? (
              <p className="page-eyebrow">
                {flow === "in" ? "Money in, not earned" : "Between your accounts"}
              </p>
            ) : flow === "in" && kindValue !== "INCOME" ? (
              <p className="page-eyebrow">Incoming — recategorise</p>
            ) : (
              <p className="page-eyebrow">{categoryKindLabel(kindValue)}</p>
            )}
            <h2 className="spending-total">{nameValue || detail.category.name}</h2>
            <p className="bank-meta">
              {formatMoney(detail.totalSpent)} · {detail.transactionCount}{" "}
              {isTransferCategory ? "movements" : "transactions"} ·{" "}
              {detail.periodLabel ?? spendingPeriodLabel(period)}
              {isTransferCategory
                ? flow === "in"
                  ? " · excluded from earned income"
                  : " · excluded from spending"
                : ""}
            </p>
          </div>
        </div>
        <PeriodPicker period={period} onChange={setPeriod} />
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
          <CategoryKindFields
            value={kindValue}
            onChange={setKindValue}
            disabled={isSystemCategory}
            isBill={isBillValue}
            isEssential={isEssentialValue}
            onBillChange={setIsBillValue}
            onEssentialChange={setIsEssentialValue}
          />
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
              Other is a system expense category — you can change its icon and
              colour, but not its name, type, or delete it.
            </p>
          ) : (
            <p className="bank-meta">
              Expense counts as spending, income as earned, transfer as money
              moving. Deleting moves transactions in this category to Other.
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
