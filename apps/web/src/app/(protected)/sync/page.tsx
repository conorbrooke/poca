import { Suspense } from "react";
import { SyncClient } from "./sync-client";

export default function SyncPage() {
  return (
    <div className="page">
      <header className="page-header">
        <p className="page-eyebrow">Bank connections</p>
        <h1 className="page-title">Connect & sync</h1>
        <p className="page-subtitle">
          Link your Irish bank accounts and pull in transactions. Revolut limits
          older history — see the note on that bank when you connect.
        </p>
      </header>
      <Suspense
        fallback={
          <div className="empty-state">
            <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
            <p>Loading banks…</p>
          </div>
        }
      >
        <SyncClient />
      </Suspense>
    </div>
  );
}
