"use client";

import { useEffect, useState } from "react";
import { Modal } from "./modal";
import { CategorySelect } from "./category-select";
import { apiFetch } from "../lib/api";
import type { CategoryOption, TagOption } from "../lib/types";

type BulkEditPanelProps = {
  selectedCount: number;
  categories: CategoryOption[];
  onClose: () => void;
  onSave: (input: {
    changeCategory: boolean;
    categoryId: string;
    changeTags: boolean;
    tagIds: string[];
    tagMode: "set" | "add";
  }) => Promise<void>;
};

export function BulkEditPanel({
  selectedCount,
  categories,
  onClose,
  onSave,
}: BulkEditPanelProps) {
  const [tags, setTags] = useState<TagOption[]>([]);
  const [changeCategory, setChangeCategory] = useState(true);
  const [categoryId, setCategoryId] = useState(
    categories.find((c) => c.name !== "Other")?.id ?? categories[0]?.id ?? "",
  );
  const [changeTags, setChangeTags] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<"set" | "add">("add");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<TagOption[]>("/spending/tags")
      .then(setTags)
      .catch(() => setTags([]));
  }, []);

  async function handleSave() {
    if (!changeCategory && !changeTags) {
      setError("Choose at least one field to update");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        changeCategory,
        categoryId,
        changeTags,
        tagIds: selectedTagIds,
        tagMode,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
        <div className="modal-header">
          <div>
            <p className="page-eyebrow">Bulk edit</p>
            <h2 className="section-title">
              {selectedCount} transaction{selectedCount === 1 ? "" : "s"}
            </h2>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={changeCategory}
            onChange={(event) => setChangeCategory(event.target.checked)}
          />
          Change category
        </label>
        {changeCategory ? (
          <label className="login-label">
            Category
            <CategorySelect
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
            />
          </label>
        ) : null}

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={changeTags}
            onChange={(event) => setChangeTags(event.target.checked)}
          />
          Update tags
        </label>
        {changeTags ? (
          <>
            <fieldset className="scope-fieldset">
              <legend className="login-label">Tag mode</legend>
              <label className="radio-label">
                <input
                  type="radio"
                  name="tagMode"
                  checked={tagMode === "add"}
                  onChange={() => setTagMode("add")}
                />
                Add tags (keep existing)
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="tagMode"
                  checked={tagMode === "set"}
                  onChange={() => setTagMode("set")}
                />
                Replace tags
              </label>
            </fieldset>
            <div className="tag-chip-row">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-chip${selectedTagIds.includes(tag.id) ? " active" : ""}`}
                  onClick={() =>
                    setSelectedTagIds((current) =>
                      current.includes(tag.id)
                        ? current.filter((id) => id !== tag.id)
                        : [...current, tag.id],
                    )
                  }
                >
                  <span
                    className="tag-chip-dot"
                    style={{ background: tag.color }}
                  />
                  {tag.name}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {error ? <p className="alert alert-error">{error}</p> : null}

        <button
          type="button"
          className="btn btn-primary login-submit"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : `Apply to ${selectedCount}`}
        </button>
    </Modal>
  );
}
