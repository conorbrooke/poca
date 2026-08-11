"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../../../lib/api";

type CallbackResult = {
  connectionId: string;
  accountCount: number;
  status: string;
};

type SyncResult = {
  syncedCount: number;
};

export function BankCallbackClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState("Completing bank connection…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setError("Missing authorisation code or state from your bank.");
      return;
    }

    async function completeFlow() {
      try {
        const result = await apiFetch<CallbackResult>("/bank/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        });

        setMessage("Bank connected. Syncing your latest transactions…");

        const sync = await apiFetch<SyncResult>("/bank/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bankConnectionId: result.connectionId }),
        });

        setMessage(
          `All set — ${result.accountCount} account(s) linked, ${sync.syncedCount} transaction(s) synced.`,
        );

        setTimeout(() => {
          router.push(`/dashboard?bank=${result.connectionId}`);
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed");
      }
    }

    void completeFlow();
  }, [searchParams, router]);

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <header className="page-header">
        <p className="page-eyebrow">Bank connection</p>
        <h1 className="page-title">
          {error ? "Connection failed" : "Almost there"}
        </h1>
      </header>

      {error ? (
        <>
          <div className="alert alert-error">{error}</div>
          <Link href="/sync" className="btn btn-secondary">
            Back to connect
          </Link>
        </>
      ) : (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
          <span className="loading-spinner" />
          <p style={{ color: "var(--accent)" }}>{message}</p>
        </div>
      )}
    </div>
  );
}
