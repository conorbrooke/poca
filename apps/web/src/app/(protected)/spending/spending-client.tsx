"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SPENDING_RANGES } from "@poca/shared";
import { apiFetch } from "../../../lib/api";
import { formatMoney } from "../../../lib/format";
import { useSpendingRange } from "../../../lib/spending-range";
import type {
  SpendingCategorySummary,
  SpendingSummaryResponse,
  TagOption,
} from "../../../lib/types";

type SpendingClientProps = {
  initialRange?: string;
};

export function SpendingClient({ initialRange }: SpendingClientProps) {
  const searchParams = useSearchParams();
  const urlRange = searchParams.get("range") ?? initialRange ?? null;
  const [range, setRange] = useSpendingRange(urlRange);
  const [data, setData] = useState<SpendingSummaryResponse | null>(null);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bankConnectionId = searchParams.get("bank") ?? undefined;

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range });
      if (bankConnectionId) params.set("bankConnectionId", bankConnectionId);
      if (selectedTagIds.length > 0) params.set("tagIds", selectedTagIds.join(","));
      const [summary, tagList] = await Promise.all([
        apiFetch<SpendingSummaryResponse>(`/spending/summary?${params.toString()}`),
        apiFetch<TagOption[]>("/spending/tags"),
      ]);
      setData(summary);
      setTags(tagList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load spending");
    } finally {
      setLoading(false);
    }
  }, [range, bankConnectionId, selectedTagIds]);

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
  const tagsHref = bankConnectionId
    ? `/spending/tags?bank=${bankConnectionId}`
    : "/spending/tags";

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="spending-subnav">
        <Link href="/spending" className="tag-chip active">
          Categories
        </Link>
        <Link href={tagsHref} className="tag-chip">
          Tags
        </Link>
      </div>

      <div className="spending-hero card">
        <div className="spending-hero-top">
          <div>
            <p className="page-eyebrow">Spending overview</p>
            <h2 className="spending-total">
              {formatMoney(data?.totalSpent ?? 0)}
            </h2>
            <p className="bank-meta">
              {data?.transactionCount ?? 0} expense transactions ·{" "}
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

      {tags.length > 0 ? (
        <div className="card" style={{ marginBottom: "1rem", padding: "1rem" }}>
          <p className="login-label">Filter by tags</p>
          <div className="tag-chip-row">
            {tags.map((tag) => {
              const active = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-chip${active ? " active" : ""}`}
                  onClick={() =>
                    setSelectedTagIds((current) =>
                      active
                        ? current.filter((id) => id !== tag.id)
                        : [...current, tag.id],
                    )
                  }
                >
                  <span className="tag-chip-dot" style={{ background: tag.color }} />
                  {tag.icon ? `${tag.icon} ` : ""}
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {data?.transfersCategory && data.totalTransferred > 0 ? (
        <MovementsCard
          category={data.transfersCategory}
          totalTransferred={data.totalTransferred}
          transferTransactionCount={data.transferTransactionCount}
          range={range}
          bankConnectionId={bankConnectionId}
          tagIds={selectedTagIds}
        />
      ) : null}

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
              tagIds={selectedTagIds}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MovementsCard({
  category,
  totalTransferred,
  transferTransactionCount,
  range,
  bankConnectionId,
  tagIds,
}: {
  category: SpendingCategorySummary;
  totalTransferred: number;
  transferTransactionCount: number;
  range: string;
  bankConnectionId?: string;
  tagIds: string[];
}) {
  const params = new URLSearchParams({ range });
  if (bankConnectionId) params.set("bank", bankConnectionId);
  if (tagIds.length > 0) params.set("tagIds", tagIds.join(","));

  return (
    <Link
      href={`/spending/${category.id}?${params.toString()}`}
      className="spending-movements-card card"
    >
      <div className="spending-movements-copy">
        <p className="page-eyebrow">Between your accounts</p>
        <h3 className="spending-movements-total">{formatMoney(totalTransferred)}</h3>
        <p className="bank-meta">
          {transferTransactionCount} movement
          {transferTransactionCount === 1 ? "" : "s"} · excluded from spending
        </p>
      </div>
      <span className="spending-movements-icon">{category.icon ?? "↔️"}</span>
    </Link>
  );
}

function CategoryRow({
  category,
  range,
  bankConnectionId,
  tagIds,
}: {
  category: SpendingCategorySummary;
  range: string;
  bankConnectionId?: string;
  tagIds: string[];
}) {
  const params = new URLSearchParams({ range });
  if (bankConnectionId) params.set("bank", bankConnectionId);
  if (tagIds.length > 0) params.set("tagIds", tagIds.join(","));

  return (
    <Link
      href={`/spending/${category.id}?${params.toString()}`}
      className={`spending-category-row${category.isSystem ? " other" : ""}`}
    >
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
