import { Suspense } from "react";
import { TagsClient } from "./tags-client";

export default function SpendingTagsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <p className="page-eyebrow">Organise · Track · Understand</p>
        <h1 className="page-title">Tags</h1>
        <p className="page-subtitle">
          Group related spending across categories — for example Car Costs on
          both fuel and insurance.
        </p>
      </header>
      <Suspense
        fallback={
          <div className="empty-state">
            <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
            <p>Loading…</p>
          </div>
        }
      >
        <TagsClient />
      </Suspense>
    </div>
  );
}
