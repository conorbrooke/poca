import { Suspense } from "react";
import { BillsClient } from "./bills-client";

export default function BillsPage() {
  return (
    <Suspense fallback={<p className="bank-meta">Loading…</p>}>
      <BillsClient />
    </Suspense>
  );
}
