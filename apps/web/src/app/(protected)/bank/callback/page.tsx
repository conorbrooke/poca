import { Suspense } from "react";
import { BankCallbackClient } from "./callback-client";

export default function BankCallbackPage() {
  return (
    <Suspense fallback={<p style={{ padding: "4rem 1.5rem" }}>Loading…</p>}>
      <BankCallbackClient />
    </Suspense>
  );
}
