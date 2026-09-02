"use client";

import { CATEGORY_KIND_OPTIONS, type CategoryKind } from "@poca/shared";

type CategoryKindFieldsProps = {
  value: CategoryKind;
  onChange: (kind: CategoryKind) => void;
  name: string;
  disabled?: boolean;
};

export function CategoryKindFields({
  value,
  onChange,
  name,
  disabled,
}: CategoryKindFieldsProps) {
  return (
    <fieldset className="scope-fieldset" disabled={disabled}>
      <legend className="login-label">Category type</legend>
      {CATEGORY_KIND_OPTIONS.map((option) => (
        <label key={option.id} className="radio-label kind-option">
          <input
            type="radio"
            name={name}
            checked={value === option.id}
            onChange={() => onChange(option.id)}
            disabled={disabled}
          />
          <span>
            {option.label}
            <span className="bank-meta" style={{ display: "block" }}>
              {option.hint}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
