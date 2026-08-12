"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SPENDING_RANGES } from "@poca/shared";
import { apiFetch } from "../../../lib/api";
import { formatMoney } from "../../../lib/format";
import type { SpendingCategorySummary, SpendingSummaryResponse } from "../../../lib/types";

type SpendingClientProps = {
  initialRange?: string;
};

export function SpendingClient({ initialRange = "month" }: SpendingClientProps) {
  const searchParams = useSearchParams();
  const [range, setRange] = useState(initialRange);
  const [data, setData] = useState<SpendingSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bankConnectionId = searchParams.get("bank") ?? undefined;

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range });
      if (bankConnectionId) {
        params.set("bankConnectionId", bankConnectionId);
      }
      const summary = await apiFetch<SpendingSummaryResponse>(
        `/spending/summary?${params.toString()}`,
      );
      setData(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load spending");
    } finally {
      setLoading(false);
    }
  }, [range, bankConnectionId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  async function runCategorize() {
    setError(null);
    try {
      await apiFetch("/spending/categorize", { method: "POST" });
      await loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Categorization failed");
    }
  }

  if (loading && !data) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        <p>Loading spending breakdown…</p>
      </div>
    );
  }

  const categories = data?.categories ?? [];
  const otherCategory = categories.find((c) => c.name === "Other");

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="spending-hero card">
        <div className="spending-hero-top">
          <div>
            <p className="page-eyebrow">Spending overview</p>
            <h2 className="spending-total">
              {formatMoney(data?.totalSpent ?? 0)}
            </h2>
            <p className="bank-meta">
              {data?.transactionCount ?? 0} transactions ·{" "}
              {SPENDING_RANGES.find((r) => r.id === range)?.label ?? range}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void runCategorize()}
          >
            Re-categorize
          </button>
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

      {otherCategory && otherCategory.totalSpent > 0 ? (
        <div className="alert alert-warning spending-other-banner">
          <strong>{formatMoney(otherCategory.totalSpent)}</strong> in{" "}
          <Link href={`/spending/${otherCategory.id}?range=${range}`}>
            Other
          </Link>{" "}
          — review and assign categories to improve your breakdown.
        </div>
      ) : null}

      <div className="spending-category-list">
        {categories.length === 0 ? (
          <div className="empty-state card">
            <h3>No spending in this period</h3>
            <p>Try a wider date range or sync more transactions.</p>
          </div>
        ) : (
          categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              range={range}
              bankConnectionId={bankConnectionId}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  range,
  bankConnectionId,
}: {
  category: SpendingCategorySummary;
  range: string;
  bankConnectionId?: string;
}) {
  const href = bankConnectionId
    ? `/spending/${category.id}?range=${range}&bank=${bankConnectionId}`
    : `/spending/${category.id}?range=${range}`;

  return (
    <Link href={href} className={`spending-category-row${category.isSystem ? " other" : ""}`}>
      <div className="spending-category-main">
        <span className="spending-category-icon" style={{ background: `${category.color}22` }}>
          {category.icon ?? "•"}
        </span>
        <div className="spending-category-copy">
          <p className="spending-category-name">{category.name}</p>
          <p className="bank-meta">
            {category.transactionCount} transaction
            {category.transactionCount === 1 ? "" : "s"} · {category.share}%
          </p>
        </div>
      </div>
      <div className="spending-category-bar-wrap">
        <div
          className="spending-category-bar"
          style={{
            width: `${Math.max(category.share, 4)}%`,
            background: category.color,
          }}
        />
      </div>
      <p className="spending-category-amount">{formatMoney(category.totalSpent)}</p>
    </Link>
  );
}
