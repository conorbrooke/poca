import { Suspense } from "react";
import { IncomeClient } from "./income-client";

export default function IncomePage() {
  return (
    <div className="page">
      <header className="page-header">
        <p className="page-eyebrow">Organise · Track · Understand</p>
        <h1 className="page-title">Income</h1>
        <p className="page-subtitle">
          Incoming money: salary, sales, interest, and anything else you earn.
          Put reimbursements, deposits, and top-ups in Transfers.
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
        <IncomeClient />
      </Suspense>
    </div>
  );
}
