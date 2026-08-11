import type { DashboardTransaction } from "../lib/types";
import { formatDate, formatMoney } from "../lib/format";

type TransactionListProps = {
  transactions: DashboardTransaction[];
  emptyMessage?: string;
};

export function TransactionList({
  transactions,
  emptyMessage = "No transactions yet. Connect a bank and sync to see activity.",
}: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="empty-state card">
        <h3>No transactions</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="transaction-list">
      {transactions.map((tx) => {
        const isIncome = tx.amount >= 0;

        return (
          <article key={tx.id} className="transaction-row">
            <div className="transaction-main">
              <p className="transaction-title">{tx.description}</p>
              {tx.merchant && tx.merchant !== tx.description ? (
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
  );
}
