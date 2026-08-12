import { Suspense } from "react";
import { DashboardClient } from "./dashboard-client";

export default function DashboardPage() {
  return (
    <div className="page">
      <header className="page-header">
        <p className="page-eyebrow">Overview</p>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Balances, spending stats, and every transaction across your linked
          banks. Older transactions are kept — new syncs add and update records.
        </p>
      </header>
      <Suspense
        fallback={
          <div className="empty-state">
            <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
            <p>Loading dashboard…</p>
          </div>
        }
      >
        <DashboardClient />
      </Suspense>
    </div>
  );
}
