"use client";

import {
  CATEGORY_KIND_OPTIONS,
  groupCategoriesByKind,
  type CategoryKind,
} from "@poca/shared";
import type { CategoryOption } from "../lib/types";

const KIND_ORDER: CategoryKind[] = ["EXPENSE", "INCOME", "TRANSFER"];

type CategorySelectProps = {
  categories: CategoryOption[];
  value: string;
  onChange: (categoryId: string) => void;
};

export function CategorySelect({
  categories,
  value,
  onChange,
}: CategorySelectProps) {
  const grouped = groupCategoriesByKind(categories);

  return (
    <select
      className="login-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {KIND_ORDER.map((kind) => {
        const group = grouped[kind];
        if (group.length === 0) return null;
        const label =
          CATEGORY_KIND_OPTIONS.find((option) => option.id === kind)?.label ??
          kind;
        return (
          <optgroup key={kind} label={label}>
            {group.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon ? `${category.icon} ` : ""}
                {category.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
