import { Suspense } from "react";
import { BudgetClient } from "./budget-client";

export default function BudgetPage() {
  return (
    <Suspense fallback={<p className="bank-meta">Loading…</p>}>
      <BudgetClient />
    </Suspense>
  );
}
