"use client";

import { useState } from "react";
import type { CategoryKind } from "@poca/shared";
import { CategoryKindFields } from "./category-kind-fields";
import { apiFetch } from "../lib/api";
import type { CategoryOption } from "../lib/types";

type AddCategoryFormProps = {
  defaultKind: CategoryKind;
  onCreated: (category: CategoryOption) => void;
};

export function AddCategoryForm({
  defaultKind,
  onCreated,
}: AddCategoryFormProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [kind, setKind] = useState<CategoryKind>(defaultKind);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      const created = await apiFetch<CategoryOption>("/spending/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          kind,
          ...(icon.trim() ? { icon: icon.trim() } : {}),
        }),
      });
      setName("");
      setIcon("");
      setKind(defaultKind);
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="card"
      style={{ marginTop: "1rem", marginBottom: "1.5rem" }}
      onSubmit={(event) => void handleSubmit(event)}
    >
      <h2 className="section-title">Add a category</h2>
      <p className="bank-meta" style={{ marginBottom: "0.75rem" }}>
        Choose whether it is spending, earned income, or money moving between
        accounts.
      </p>
      <label className="login-label">
        Name
        <input
          className="login-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Sales, Dividends, or Pet care"
        />
      </label>
      <label className="login-label">
        Icon (optional)
        <input
          className="login-input"
          value={icon}
          onChange={(event) => setIcon(event.target.value)}
          placeholder="🏷️"
        />
      </label>
      <CategoryKindFields value={kind} onChange={setKind} />
      {error ? <p className="alert alert-error">{error}</p> : null}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={saving || !name.trim()}
        style={{ marginTop: "0.75rem" }}
      >
        {saving ? "Adding…" : "Add category"}
      </button>
    </form>
  );
}
