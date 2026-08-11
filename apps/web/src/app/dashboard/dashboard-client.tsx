"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StatsGrid } from "../../components/stats-grid";
import { TransactionList } from "../../components/transaction-list";
import { apiFetch } from "../../lib/api";
import { formatMoney, formatRelativeSync } from "../../lib/format";
import type { DashboardResponse } from "../../lib/types";

export function DashboardClient() {
  const searchParams = useSearchParams();
  const selectedBankId = searchParams.get("bank");

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setError(null);
    try {
      const query = selectedBankId
        ? `?bankConnectionId=${encodeURIComponent(selectedBankId)}`
        : "";
      const dashboard = await apiFetch<DashboardResponse>(
        `/bank/dashboard${query}`,
      );
      setData(dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [selectedBankId]);

  useEffect(() => {
    setLoading(true);
    void loadDashboard();
  }, [loadDashboard]);

  const activeBank = useMemo(() => {
    if (!data || !selectedBankId) return null;
    return data.banks.find((bank) => bank.id === selectedBankId) ?? null;
  }, [data, selectedBankId]);

  const linkedConnections = useMemo(
    () => data?.connections.filter((c) => c.status === "LINKED") ?? [],
    [data],
  );

  async function syncSelectedBank() {
    if (!selectedBankId) return;

    setSyncing(true);
    setError(null);
    setMessage(null);

    try {
      const result = await apiFetch<{ syncedCount: number }>("/bank/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankConnectionId: selectedBankId }),
      });
      setMessage(
        `Added or updated ${result.syncedCount} transaction${result.syncedCount === 1 ? "" : "s"}.`,
      );
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        <p>Loading dashboard…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state card">
        <h3>Could not load dashboard</h3>
        <p>{error ?? "Something went wrong."}</p>
      </div>
    );
  }

  const stats = activeBank
    ? { ...activeBank.stats, totalBalance: activeBank.totalBalance }
    : data.stats;
  const showBalance = true;

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      <div className="bank-tabs">
        <Link
          href="/dashboard"
          className={`bank-tab${!selectedBankId ? " active" : ""}`}
        >
          All banks
        </Link>
        {linkedConnections.map((connection) => (
          <Link
            key={connection.id}
            href={`/dashboard?bank=${connection.id}`}
            className={`bank-tab${selectedBankId === connection.id ? " active" : ""}`}
          >
            {connection.institutionName}
          </Link>
        ))}
      </div>

      {linkedConnections.length === 0 ? (
        <div className="empty-state card">
          <h3>No banks connected yet</h3>
          <p>
            Connect a bank to start tracking your spending and income.
          </p>
          <Link href="/sync" className="btn btn-primary" style={{ marginTop: "1rem" }}>
            Connect a bank
          </Link>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <div>
              <h2 className="section-title" style={{ marginBottom: "0.25rem" }}>
                {activeBank ? activeBank.institutionName : "All banks"}
              </h2>
              {activeBank?.lastSyncedAt ? (
                <p className="bank-meta">
                  {formatRelativeSync(activeBank.lastSyncedAt)}
                </p>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {selectedBankId ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={syncing}
                  onClick={() => void syncSelectedBank()}
                >
                  {syncing ? (
                    <>
                      <span className="loading-spinner" />
                      Syncing…
                    </>
                  ) : (
                    "Sync latest"
                  )}
                </button>
              ) : null}
              <Link href="/sync" className="btn btn-secondary">
                Manage banks
              </Link>
            </div>
          </div>

          <StatsGrid stats={stats} showBalance={showBalance} />

          {activeBank && activeBank.accounts.length > 0 ? (
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <h3 className="section-title">Accounts</h3>
              <div className="bank-grid">
                {activeBank.accounts.map((account) => (
                  <div key={account.id} className="bank-card connected">
                    <p className="bank-name">{account.name}</p>
                    <p className="stat-value balance" style={{ fontSize: "1.125rem" }}>
                      {formatMoney(account.currentBalance, account.currency)}
                    </p>
                    <p className="bank-meta">
                      {account.iban ?? "No IBAN"} · {account.transactionCount}{" "}
                      transactions
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <h2 className="section-title">Transactions</h2>
          <TransactionList transactions={data.transactions} />
        </>
      )}
    </div>
  );
}
