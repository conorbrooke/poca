import Link from "next/link";
import { formatMoney } from "../lib/format";
import type { SpendingCategorySummary } from "../lib/types";

type TransfersSectionProps = {
  transferCategories: SpendingCategorySummary[];
  totalTransferred: number;
  transferTransactionCount: number;
  range: string;
  bankConnectionId?: string;
  tagIds?: string[];
  flow: "out" | "in";
};

export function TransfersSection({
  transferCategories,
  totalTransferred,
  transferTransactionCount,
  range,
  bankConnectionId,
  tagIds = [],
  flow,
}: TransfersSectionProps) {
  const basePath = flow === "in" ? "/income" : "/spending";
  const eyebrow =
    flow === "in" ? "Money in, not earned" : "Between your accounts";
  const footnote =
    flow === "in"
      ? "deposits, reimbursements, account top-ups"
      : "excluded from spending";

  if (transferCategories.length === 1) {
    const category = transferCategories[0]!;
    const params = buildCategoryParams(range, flow, bankConnectionId, tagIds);

    return (
      <Link
        href={`${basePath}/${category.id}?${params.toString()}`}
        className="spending-movements-card card"
      >
        <div className="spending-movements-copy">
          <p className="page-eyebrow">{eyebrow}</p>
          <h3 className="spending-movements-total">{formatMoney(totalTransferred)}</h3>
          <p className="bank-meta">
            {transferTransactionCount} movement
            {transferTransactionCount === 1 ? "" : "s"} · {footnote}
          </p>
        </div>
        <span className="spending-movements-icon">{category.icon ?? "↔️"}</span>
      </Link>
    );
  }

  return (
    <div className="transfers-section">
      <div className="card transfers-summary-card">
        <p className="page-eyebrow">{eyebrow}</p>
        <h3 className="spending-movements-total">{formatMoney(totalTransferred)}</h3>
        <p className="bank-meta">
          {transferTransactionCount} movement
          {transferTransactionCount === 1 ? "" : "s"} · {footnote}
        </p>
      </div>
      <div className="spending-category-list">
        {transferCategories.map((category) => (
          <TransferCategoryRow
            key={category.id}
            category={category}
            range={range}
            bankConnectionId={bankConnectionId}
            tagIds={tagIds}
            basePath={basePath}
            flow={flow}
          />
        ))}
      </div>
    </div>
  );
}

export function TransferCategoryNav({
  transferCategories,
  activeCategoryId,
  range,
  bankConnectionId,
  tagIds,
  flow,
  basePath,
}: {
  transferCategories: SpendingCategorySummary[];
  activeCategoryId: string;
  range: string;
  bankConnectionId?: string;
  tagIds?: string[];
  flow: "out" | "in";
  basePath: string;
}) {
  if (transferCategories.length <= 1) return null;

  return (
    <div className="spending-subnav transfer-category-nav">
      {transferCategories.map((category) => {
        const params = buildCategoryParams(range, flow, bankConnectionId, tagIds);
        const active = category.id === activeCategoryId;
        return (
          <Link
            key={category.id}
            href={`${basePath}/${category.id}?${params.toString()}`}
            className={`tag-chip${active ? " active" : ""}`}
          >
            {category.icon ? `${category.icon} ` : ""}
            {category.name}
          </Link>
        );
      })}
    </div>
  );
}

function TransferCategoryRow({
  category,
  range,
  bankConnectionId,
  tagIds,
  basePath,
  flow,
}: {
  category: SpendingCategorySummary;
  range: string;
  bankConnectionId?: string;
  tagIds: string[];
  basePath: string;
  flow: "out" | "in";
}) {
  const params = buildCategoryParams(range, flow, bankConnectionId, tagIds);

  return (
    <Link
      href={`${basePath}/${category.id}?${params.toString()}`}
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

function buildCategoryParams(
  range: string,
  flow: "out" | "in",
  bankConnectionId?: string,
  tagIds: string[] = [],
) {
  const params = new URLSearchParams({ range });
  if (flow === "in") params.set("flow", "in");
  if (bankConnectionId) params.set("bank", bankConnectionId);
  if (tagIds.length > 0) params.set("tagIds", tagIds.join(","));
  return params;
}
