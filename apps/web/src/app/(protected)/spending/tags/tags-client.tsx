"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SPENDING_RANGES } from "@poca/shared";
import { apiFetch } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/format";
import type { TagOption, TagSummaryResponse } from "../../../../lib/types";

export function TagsClient() {
  const searchParams = useSearchParams();
  const [range, setRange] = useState("month");
  const [tags, setTags] = useState<TagOption[]>([]);
  const [summaries, setSummaries] = useState<TagSummaryResponse[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bankConnectionId = searchParams.get("bank") ?? undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tagList = await apiFetch<TagOption[]>("/spending/tags");
      setTags(tagList);
      const params = new URLSearchParams({ range });
      if (bankConnectionId) params.set("bankConnectionId", bankConnectionId);
      const rows = await Promise.all(
        tagList.map((tag) =>
          apiFetch<TagSummaryResponse>(
            `/spending/tags/${tag.id}?${params.toString()}`,
          ),
        ),
      );
      setSummaries(rows.sort((a, b) => b.totalSpent - a.totalSpent));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, [range, bankConnectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTag() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    try {
      await apiFetch("/spending/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setNewName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create tag");
    }
  }

  if (loading && tags.length === 0) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        <p>Loading tags…</p>
      </div>
    );
  }

  const bankQuery = bankConnectionId ? `&bank=${bankConnectionId}` : "";

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="spending-subnav">
        <Link href="/spending" className="tag-chip">
          Categories
        </Link>
        <Link href="/spending/tags" className="tag-chip active">
          Tags
        </Link>
      </div>

      <div className="spending-hero card">
        <div className="spending-hero-top">
          <div>
            <p className="page-eyebrow">Cross-category groups</p>
            <h2 className="spending-total">{tags.length} tags</h2>
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
        <label className="login-label" style={{ marginTop: "1rem" }}>
          New tag
          <div className="tag-chip-row">
            <input
              className="login-input"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Car Costs"
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void createTag()}
            >
              Create
            </button>
          </div>
        </label>
      </div>

      <div className="spending-category-list">
        {summaries.length === 0 ? (
          <div className="empty-state card">
            <h3>No tags yet</h3>
            <p>Create a tag, then apply it to transactions from any category.</p>
          </div>
        ) : (
          summaries.map((summary) => (
            <Link
              key={summary.tag.id}
              href={`/spending/tags/${summary.tag.id}?range=${range}${bankQuery}`}
              className="spending-category-row"
            >
              <div className="spending-category-main">
                <span
                  className="spending-category-icon"
                  style={{ background: `${summary.tag.color}22` }}
                >
                  {summary.tag.icon ?? "•"}
                </span>
                <div className="spending-category-copy">
                  <p className="spending-category-name">{summary.tag.name}</p>
                  <p className="bank-meta">
                    {summary.transactionCount} transaction
                    {summary.transactionCount === 1 ? "" : "s"} ·{" "}
                    {summary.categories.map((c) => c.name).join(", ") || "No spend"}
                  </p>
                </div>
              </div>
              <p className="spending-category-amount">
                {formatMoney(summary.totalSpent)}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
