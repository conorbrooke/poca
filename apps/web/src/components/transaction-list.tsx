import type { DashboardTransaction } from "../lib/types";
import { formatDate, formatMoney } from "../lib/format";

type TransactionListProps = {
  transactions: DashboardTransaction[];
  emptyMessage?: string;
  loading?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

function uniqueTags(tags: DashboardTransaction["tags"]) {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    if (seen.has(tag.id)) return false;
    seen.add(tag.id);
    return true;
  });
}

function CategoryPill({
  name,
  color,
  icon,
  kind,
}: {
  name: string;
  color: string;
  icon?: string | null;
  kind?: "EXPENSE" | "INCOME" | "TRANSFER" | null;
}) {
  return (
    <span
      className="tx-category-pill"
      style={{
        borderColor: `${color}55`,
        background: `${color}18`,
        color,
      }}
    >
      {icon ? `${icon} ` : ""}
      {name}
      {kind === "TRANSFER" ? (
        <span className="transfer-kind-label"> · between your accounts</span>
      ) : null}
    </span>
  );
}

function TransferLinkBadge({
  transfer,
}: {
  transfer: DashboardTransaction["transfer"];
}) {
  if (!transfer) return null;

  const counterparty = transfer.counterparty;
  const label =
    transfer.direction === "out"
      ? counterparty
        ? `→ ${counterparty.institutionName || counterparty.accountName}`
        : "Awaiting matching deposit"
      : counterparty
        ? `← ${counterparty.institutionName || counterparty.accountName}`
        : null;

  if (!label) return null;

  return (
    <span
      className={`transfer-link-badge${transfer.status === "SUGGESTED" ? " suggested" : ""}`}
    >
      {label}
      {transfer.status === "SUGGESTED" ? " · suggested" : ""}
    </span>
  );
}

function TransactionClassification({ tx }: { tx: DashboardTransaction }) {
  const isExpense = tx.amount < 0;
  const tags = uniqueTags(tx.tags ?? []);
  const splitCategories = tx.splitCategories ?? [];
  const splitTags = uniqueTags(tx.splitTags ?? []);

  if (tx.isSplit && splitCategories.length > 0) {
    const uniqueCategories = [
      ...new Map(splitCategories.map((item) => [item.name, item])).values(),
    ];

    return (
      <div className="transaction-classification">
        <span className="split-badge">Split</span>
        {uniqueCategories.map((category) => (
          <CategoryPill key={category.name} {...category} />
        ))}
        <TransferLinkBadge transfer={tx.transfer} />
        {splitTags.map((tag) => (
          <span
            key={tag.id}
            className="transaction-tag"
            style={{ borderColor: `${tag.color}44` }}
          >
            <span className="tag-chip-dot" style={{ background: tag.color }} />
            {tag.name}
          </span>
        ))}
      </div>
    );
  }

  if (tx.category) {
    return (
      <div className="transaction-classification">
        <CategoryPill {...tx.category} kind={tx.category.kind} />
        <TransferLinkBadge transfer={tx.transfer} />
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="transaction-tag"
            style={{ borderColor: `${tag.color}44` }}
          >
            <span className="tag-chip-dot" style={{ background: tag.color }} />
            {tag.name}
          </span>
        ))}
      </div>
    );
  }

  if (!isExpense) return null;

  return (
    <div className="transaction-classification">
      <span className="tx-category-pill uncategorized">Uncategorized</span>
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="transaction-tag"
          style={{ borderColor: `${tag.color}44` }}
        >
          <span className="tag-chip-dot" style={{ background: tag.color }} />
          {tag.name}
        </span>
      ))}
    </div>
  );
}

export function TransactionList({
  transactions,
  emptyMessage = "No transactions yet. Connect a bank and sync to see activity.",
  loading = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: TransactionListProps) {
  if (loading && transactions.length === 0) {
    return (
      <div className="empty-state card">
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        <p>Loading transactions…</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="empty-state card">
        <h3>No transactions</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="transaction-list">
        {transactions.map((tx) => {
          const isIncome = tx.amount >= 0;
          const title = tx.payeeLabel ?? tx.description;
          const showDescription =
            tx.payeeLabel &&
            tx.payeeLabel.trim() !== tx.description.trim();

          return (
            <article key={tx.id} className="transaction-row">
              <div className="transaction-main">
                <p className="transaction-title">{title}</p>
                {showDescription ? (
                  <p className="transaction-subtitle">{tx.description}</p>
                ) : tx.merchant && tx.merchant !== title ? (
                  <p className="transaction-subtitle">{tx.merchant}</p>
                ) : null}
                <div className="transaction-meta">
                  <span>{formatDate(tx.bookedAt)}</span>
                  <span>{tx.institutionName}</span>
                  <span>{tx.accountName}</span>
                  {tx.accountIban ? (
                    <span>···{tx.accountIban.slice(-4)}</span>
                  ) : null}
                </div>
                <TransactionClassification tx={tx} />
              </div>
              <p
                className={`transaction-amount ${isIncome ? "income" : "expense"}`}
              >
                {formatMoney(tx.amount, tx.currency, { signed: true })}
              </p>
            </article>
          );
        })}
      </div>
      {hasMore && onLoadMore ? (
        <div className="load-more-row">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? (
              <>
                <span className="loading-spinner" />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </button>
        </div>
      ) : null}
    </>
  );
}
