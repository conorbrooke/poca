"use client";

import {
  computeLoanOfferSummary,
  isLoanWealthClass,
  loanPrincipalFromTerms,
} from "@poca/shared";
import { formatMoney } from "../lib/format";
import { LoanOfferSummaryView } from "./loan-offer-summary";

export type LoanTermDraft = {
  currentValue: string;
  totalCostOfCredit: string;
  totalRepaymentAmount: string;
  interestRate: string;
  annualPercentageRate: string;
};

export const emptyLoanTermDraft = (): LoanTermDraft => ({
  currentValue: "",
  totalCostOfCredit: "",
  totalRepaymentAmount: "",
  interestRate: "",
  annualPercentageRate: "",
});

function parseEuro(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercent(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / 100 : null;
}

export function loanTermsPayload(
  cls: string,
  draft: LoanTermDraft,
  monthlyPaymentHint?: number | null,
): {
  currentValue?: number;
  interestRate?: number | null;
  minimumPayment?: number | null;
} {
  if (!isLoanWealthClass(cls)) {
    const value = parseEuro(draft.currentValue);
    return value != null ? { currentValue: value } : {};
  }

  const principal =
    loanPrincipalFromTerms({
      currentValue: parseEuro(draft.currentValue),
      totalCostOfCredit: parseEuro(draft.totalCostOfCredit),
      totalRepaymentAmount: parseEuro(draft.totalRepaymentAmount),
    }) ?? undefined;

  return {
    ...(principal != null ? { currentValue: principal } : {}),
    interestRate: parsePercent(draft.interestRate),
    minimumPayment:
      monthlyPaymentHint != null && monthlyPaymentHint > 0
        ? monthlyPaymentHint
        : null,
  };
}

export function loanTermsValidationError(
  cls: string,
  draft: LoanTermDraft,
  monthlyPaymentHint?: number | null,
): string | null {
  if (!isLoanWealthClass(cls)) return null;
  const principal = loanPrincipalFromTerms({
    currentValue: parseEuro(draft.currentValue),
    totalCostOfCredit: parseEuro(draft.totalCostOfCredit),
    totalRepaymentAmount: parseEuro(draft.totalRepaymentAmount),
  });
  if (principal == null || principal <= 0) {
    return "Enter the original loan amount or total repayment and total cost of credit.";
  }
  if (parsePercent(draft.interestRate) == null) {
    return "Enter the variable interest rate from your loan offer.";
  }
  return null;
}

export function loanOfferSummaryFromDraft(
  cls: string,
  draft: LoanTermDraft,
  monthlyPaymentHint?: number | null,
) {
  if (!isLoanWealthClass(cls)) return null;
  const principal = loanPrincipalFromTerms({
    currentValue: parseEuro(draft.currentValue),
    totalCostOfCredit: parseEuro(draft.totalCostOfCredit),
    totalRepaymentAmount: parseEuro(draft.totalRepaymentAmount),
  });
  if (principal == null || principal <= 0) return null;
  return computeLoanOfferSummary({
    principal,
    annualInterestRate: parsePercent(draft.interestRate),
    annualPercentageRate: parsePercent(draft.annualPercentageRate),
    monthlyPayment:
      monthlyPaymentHint != null && monthlyPaymentHint > 0
        ? monthlyPaymentHint
        : null,
  });
}

type LoanTermFieldsProps = {
  wealthClass: string;
  draft: LoanTermDraft;
  onChange: (draft: LoanTermDraft) => void;
  openingAsOf?: string;
  compact?: boolean;
  monthlyPaymentHint?: number | null;
};

export function LoanTermFields({
  wealthClass,
  draft,
  onChange,
  openingAsOf,
  compact = false,
  monthlyPaymentHint = null,
}: LoanTermFieldsProps) {
  if (!isLoanWealthClass(wealthClass)) {
    return (
      <label className="login-label">
        Opening value (€)
        <input
          className="login-input"
          type="number"
          min="0"
          step="0.01"
          value={draft.currentValue}
          onChange={(event) =>
            onChange({ ...draft, currentValue: event.target.value })
          }
          placeholder="Amount at opening date"
        />
      </label>
    );
  }

  const derived = loanPrincipalFromTerms({
    currentValue: parseEuro(draft.currentValue),
    totalCostOfCredit: parseEuro(draft.totalCostOfCredit),
    totalRepaymentAmount: parseEuro(draft.totalRepaymentAmount),
  });

  return (
    <div className={compact ? "" : "card"} style={compact ? undefined : { marginTop: "0.75rem", padding: "0.75rem" }}>
      {!compact ? (
        <p className="login-label" style={{ marginBottom: "0.5rem" }}>
          Loan terms
        </p>
      ) : null}
      <div className="tag-chip-row">
        <label className="login-label">
          Original loan amount (€)
          <input
            className="login-input"
            type="number"
            min="0"
            step="0.01"
            value={draft.currentValue}
            onChange={(event) =>
              onChange({ ...draft, currentValue: event.target.value })
            }
            placeholder="e.g. 6500"
          />
        </label>
        <label className="login-label">
          Total cost of credit (€)
          <input
            className="login-input"
            type="number"
            min="0"
            step="0.01"
            value={draft.totalCostOfCredit}
            onChange={(event) =>
              onChange({ ...draft, totalCostOfCredit: event.target.value })
            }
            placeholder="e.g. 896.56"
          />
        </label>
        <label className="login-label">
          Total repayment amount (€)
          <input
            className="login-input"
            type="number"
            min="0"
            step="0.01"
            value={draft.totalRepaymentAmount}
            onChange={(event) =>
              onChange({ ...draft, totalRepaymentAmount: event.target.value })
            }
            placeholder="e.g. 7396.56"
          />
        </label>
        <label className="login-label">
          Variable interest rate (%)
          <input
            className="login-input"
            type="number"
            min="0"
            step="0.01"
            value={draft.interestRate}
            onChange={(event) =>
              onChange({ ...draft, interestRate: event.target.value })
            }
            placeholder="e.g. 8.65"
          />
        </label>
        <label className="login-label">
          Variable APR (%)
          <input
            className="login-input"
            type="number"
            min="0"
            step="0.01"
            value={draft.annualPercentageRate}
            onChange={(event) =>
              onChange({ ...draft, annualPercentageRate: event.target.value })
            }
            placeholder="e.g. 8.90"
          />
        </label>
      </div>
      <p className="bank-meta" style={{ marginTop: "0.5rem" }}>
        Enter figures from your loan offer or statement. You can use the original
        loan amount, or total repayment minus total cost of credit
        {derived != null ? ` (${formatMoney(derived)})` : ""}.
        {openingAsOf ? ` Opening date ${openingAsOf}.` : ""}
        {monthlyPaymentHint != null && monthlyPaymentHint > 0
          ? ` This transaction is ${formatMoney(monthlyPaymentHint)}.`
          : ""}
      </p>
      {(() => {
        const summary = loanOfferSummaryFromDraft(
          wealthClass,
          draft,
          monthlyPaymentHint,
        );
        return summary ? (
          <LoanOfferSummaryView summary={summary} compact />
        ) : null;
      })()}
    </div>
  );
}

export function formatLoanTermsSummary(item: {
  interestRate: number | null;
  minimumPayment?: number | null;
  currentValue: number;
  loanSummary?: {
    totalCostOfCredit: number | null;
    totalRepaymentAmount: number | null;
    variableApr: number | null;
    variableInterestRate: number | null;
  } | null;
}): string[] {
  const summary = item.loanSummary;
  if (summary) {
    const lines: string[] = [];
    if (summary.totalCostOfCredit != null) {
      lines.push(`Total cost of credit ${formatMoney(summary.totalCostOfCredit)}`);
    }
    if (summary.totalRepaymentAmount != null) {
      lines.push(`Total repayment ${formatMoney(summary.totalRepaymentAmount)}`);
    }
    if (summary.variableApr != null) {
      lines.push(`Variable APR ${(summary.variableApr * 100).toFixed(2)}%`);
    }
    if (summary.variableInterestRate != null) {
      lines.push(`Variable rate ${(summary.variableInterestRate * 100).toFixed(2)}%`);
    }
    return lines;
  }
  const lines: string[] = [];
  if (item.interestRate != null) {
    lines.push(`Variable rate ${(item.interestRate * 100).toFixed(2)}%`);
  }
  if (item.minimumPayment != null) {
    lines.push(`Monthly payment ${formatMoney(item.minimumPayment)}`);
  }
  return lines;
}

export function itemToLoanDraft(item: {
  currentValue: number;
  interestRate: number | null;
}): LoanTermDraft {
  return {
    currentValue: String(item.currentValue),
    totalCostOfCredit: "",
    totalRepaymentAmount: "",
    interestRate:
      item.interestRate != null ? String(item.interestRate * 100) : "",
    annualPercentageRate:
      item.interestRate != null ? String(item.interestRate * 100) : "",
  };
}
