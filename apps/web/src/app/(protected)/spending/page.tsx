import { Suspense } from "react";
import { SpendingClient } from "./spending-client";

export default function SpendingPage() {
  return (
    <div className="page">
      <header className="page-header">
        <p className="page-eyebrow">Organise · Track · Understand</p>
        <h1 className="page-title">Spending</h1>
        <p className="page-subtitle">
          See where your money goes by category and merchant. Amounts are in
          euros; other currencies use today's rates.
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
        <SpendingClient />
      </Suspense>
    </div>
  );
}
