"use client";

import type { LoanOfferSummary } from "@poca/shared";
import { formatMoney } from "../lib/format";

type LoanOfferSummaryProps = {
  summary: LoanOfferSummary;
  compact?: boolean;
};

export function LoanOfferSummaryView({
  summary,
  compact = false,
}: LoanOfferSummaryProps) {
  const hasFigures =
    summary.totalCostOfCredit != null ||
    summary.totalRepaymentAmount != null ||
    summary.variableApr != null ||
    summary.variableInterestRate != null;

  if (!hasFigures) return null;

  const rows: Array<{ label: string; value: string }> = [];
  if (summary.totalCostOfCredit != null) {
    rows.push({
      label: "Total cost of credit",
      value: formatMoney(summary.totalCostOfCredit),
    });
  }
  if (summary.totalRepaymentAmount != null) {
    rows.push({
      label: "Total repayment amount",
      value: formatMoney(summary.totalRepaymentAmount),
    });
  }
  if (summary.variableApr != null) {
    rows.push({
      label: "Variable annual percentage rate",
      value: `${(summary.variableApr * 100).toFixed(2)}%`,
    });
  }
  if (summary.variableInterestRate != null) {
    rows.push({
      label: "Variable interest rate",
      value: `${(summary.variableInterestRate * 100).toFixed(2)}%`,
    });
  }

  return (
    <div
      className={compact ? "" : "card"}
      style={compact ? { marginTop: "0.75rem" } : { marginTop: "0.75rem", padding: "0.75rem" }}
    >
      {rows.map((row) => (
        <div key={row.label} className="spending-category-row" style={{ border: "none", padding: "0.35rem 0" }}>
          <p className="bank-meta">{row.label}</p>
          <p className="spending-category-amount">{row.value}</p>
        </div>
      ))}
      {summary.termMonths != null && summary.monthlyPayment != null ? (
        <p className="bank-meta" style={{ marginTop: "0.35rem" }}>
          {summary.termMonths} monthly payments of {formatMoney(summary.monthlyPayment)} at opening
          balance {formatMoney(summary.principal)}.
        </p>
      ) : null}
      <p className="bank-meta" style={{ marginTop: "0.35rem", opacity: 0.75 }}>
        Calculated from your loan amount, rate, and repayment — not stored separately.
      </p>
    </div>
  );
}
