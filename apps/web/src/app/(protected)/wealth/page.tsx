import { Suspense } from "react";
import { WealthOverviewClient } from "./overview-client";

export default function WealthPage() {
  return (
    <Suspense
      fallback={
        <div className="empty-state">
          <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
          <p>Loading wealth…</p>
        </div>
      }
    >
      <WealthOverviewClient />
    </Suspense>
  );
}
