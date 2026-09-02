"use client";

import { CATEGORY_KIND_OPTIONS, type CategoryKind } from "@poca/shared";

type CategoryKindFieldsProps = {
  value: CategoryKind;
  onChange: (kind: CategoryKind) => void;
  disabled?: boolean;
};

export function CategoryKindFields({
  value,
  onChange,
  disabled,
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
    </div>
  );
}
