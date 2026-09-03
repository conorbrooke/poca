import { Suspense } from "react";
import { HabitsClient } from "./habits-client";

export default function HabitsPage() {
  return (
    <Suspense fallback={<p className="bank-meta">Loading…</p>}>
      <HabitsClient />
    </Suspense>
  );
}
