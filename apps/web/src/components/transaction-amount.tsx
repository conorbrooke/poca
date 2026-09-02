"use client";

import { formatMoney } from "../lib/format";

type TransactionAmountProps = {
  amount: number;
  currency: string;
  amountEur?: number;
};

export function TransactionAmount({
  amount,
  currency,
  amountEur,
}: TransactionAmountProps) {
  const isIncome = amount >= 0;
  const eurAmount = amountEur ?? amount;
  const showOriginal = currency.toUpperCase() !== "EUR";

  return (
    <p className={`transaction-amount ${isIncome ? "income" : "expense"}`}>
      {formatMoney(eurAmount, "EUR", { signed: true })}
      {showOriginal ? (
        <span className="transaction-amount-original">
          {formatMoney(amount, currency, { signed: true })}
        </span>
      ) : null}
    </p>
  );
}
