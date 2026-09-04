"use client";

import { CATEGORY_KIND_OPTIONS, type CategoryKind } from "@poca/shared";

type CategoryKindFieldsProps = {
  value: CategoryKind;
  onChange: (kind: CategoryKind) => void;
  disabled?: boolean;
  isBill?: boolean;
  isEssential?: boolean;
  isVariable?: boolean;
  onBillChange?: (isBill: boolean) => void;
  onEssentialChange?: (isEssential: boolean) => void;
  onVariableChange?: (isVariable: boolean) => void;
};

export function CategoryKindFields({
  value,
  onChange,
  disabled,
  isBill = false,
  isEssential = false,
  isVariable = false,
  onBillChange,
  onEssentialChange,
  onVariableChange,
}: CategoryKindFieldsProps) {
  const hint =
    CATEGORY_KIND_OPTIONS.find((option) => option.id === value)?.hint ?? "";

  return (
    <div>
      <p className="login-label">Type</p>
      <div className="range-tabs">
        {CATEGORY_KIND_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`range-tab${value === option.id ? " active" : ""}`}
            disabled={disabled}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="bank-meta" style={{ marginTop: "0.5rem" }}>
        {hint}
      </p>
      {value === "EXPENSE" && onBillChange ? (
        <label className="bank-meta" style={{ display: "block", marginTop: "0.75rem" }}>
          <input
            type="checkbox"
            checked={isBill}
            disabled={disabled}
            onChange={(event) => onBillChange(event.target.checked)}
          />{" "}
          Recurring bill — rent, utilities, insurance, subscriptions. Still
          counts as spending, also appears on Wealth → Bills, and is not treated
          as a leak.
        </label>
      ) : null}
      {value === "EXPENSE" && onEssentialChange ? (
        <label className="bank-meta" style={{ display: "block", marginTop: "0.45rem" }}>
          <input
            type="checkbox"
            checked={isEssential}
            disabled={disabled}
            onChange={(event) => onEssentialChange(event.target.checked)}
          />{" "}
          Essential (used for the emergency-fund target and variable living)
        </label>
      ) : null}
      {value === "EXPENSE" && onVariableChange ? (
        <label className="bank-meta" style={{ display: "block", marginTop: "0.45rem" }}>
          <input
            type="checkbox"
            checked={isVariable}
            disabled={disabled}
            onChange={(event) => onVariableChange(event.target.checked)}
          />{" "}
          Variable living — groceries, fuel. Amounts change; last month is the
          Budget reference.
        </label>
      ) : null}
    </div>
  );
}
