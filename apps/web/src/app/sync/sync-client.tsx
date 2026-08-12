"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { formatMoney, formatRelativeSync } from "../../lib/format";
import type {
  BankConnection,
  Institution,
  LinkResponse,
  SyncResponse,
} from "../../lib/types";
import {
  SYNC_DEFAULT_DAYS,
  SYNC_RANGE_OPTIONS,
} from "@poca/shared";

function statusClass(status: string): string {
  if (status === "LINKED") return "linked";
  if (status === "ERROR" || status === "EXPIRED") return "error";
  return "pending";
}

function BankLogo({ institution }: { institution: Institution }) {
  if (institution.logo) {
    return (
      <div className="bank-logo-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={institution.logo}
          alt=""
          className="bank-logo"
        />
      </div>
    );
  }

  return (
    <div className="bank-logo-fallback">{institution.name.charAt(0)}</div>
  );
}

export function SyncClient() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncDaysByConnection, setSyncDaysByConnection] = useState<
    Record<string, number>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [institutionList, connectionList] = await Promise.all([
        apiFetch<Institution[]>("/bank/institutions?country=IE"),
        apiFetch<BankConnection[]>("/bank/connections"),
      ]);
      setInstitutions(institutionList);
      setConnections(connectionList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load banks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const connectionByInstitution = useMemo(() => {
    const map = new Map<string, BankConnection>();
    for (const connection of connections) {
      map.set(connection.institutionId, connection);
    }
    return map;
  }, [connections]);

  const linkedInstitutions = useMemo(
    () =>
      institutions.filter((inst) => connectionByInstitution.has(inst.id)),
    [institutions, connectionByInstitution],
  );

  const availableInstitutions = useMemo(
    () =>
      institutions.filter((inst) => !connectionByInstitution.has(inst.id)),
    [institutions, connectionByInstitution],
  );

  async function connectBank(institution: Institution) {
    setConnectingId(institution.id);
    setError(null);
    setMessage(null);

    try {
      const redirectUrl = `${window.location.origin}/bank/callback`;
      const result = await apiFetch<LinkResponse>("/bank/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId: institution.id,
          redirectUrl,
        }),
      });

      window.location.href = result.link;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start bank link");
      setConnectingId(null);
    }
  }

  async function syncBank(connection: BankConnection) {
    setSyncingId(connection.id);
    setError(null);
    setMessage(null);

    const daysBack =
      syncDaysByConnection[connection.id] ?? SYNC_DEFAULT_DAYS;

    try {
      const result = await apiFetch<SyncResponse>("/bank/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankConnectionId: connection.id, daysBack }),
      });

      const rangeLabel =
        SYNC_RANGE_OPTIONS.find((option) => option.days === result.daysBack)
          ?.label.toLowerCase() ?? `last ${result.daysBack} days`;

      setMessage(
        `Synced ${result.syncedCount} transaction${result.syncedCount === 1 ? "" : "s"} from ${connection.institutionName} (${rangeLabel}).`,
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingId(null);
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        <p>Loading banks…</p>
      </div>
    );
  }

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      {linkedInstitutions.length > 0 ? (
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 className="section-title">Your banks</h2>
          <div className="bank-grid">
            {linkedInstitutions.map((institution) => {
              const connection = connectionByInstitution.get(institution.id)!;
              const balance = connection.accounts.reduce(
                (sum, account) => sum + account.currentBalance,
                0,
              );
              const txCount = connection.accounts.reduce(
                (sum, account) => sum + account.transactionCount,
                0,
              );

              return (
                <div
                  key={institution.id}
                  className="bank-card connected"
                >
                  <div className="bank-card-header">
                    <BankLogo institution={institution} />
                    <div className="bank-card-info">
                      <div className="bank-card-title-row">
                        <p className="bank-name">{institution.name}</p>
                        <span
                          className={`status-badge ${statusClass(connection.status)}`}
                        >
                          {connection.status.toLowerCase()}
                        </span>
                      </div>
                      <p className="bank-meta">
                        {formatMoney(balance)} · {txCount} transactions ·{" "}
                        {formatRelativeSync(connection.lastSyncedAt)}
                      </p>
                    </div>
                  </div>

                  {connection.lastError ? (
                    <p className="alert alert-error" style={{ margin: 0 }}>
                      {connection.lastError}
                    </p>
                  ) : null}

                  <div className="bank-card-actions">
                    <label className="sync-range-select">
                      <span className="sr-only">Sync date range</span>
                      <select
                        value={
                          syncDaysByConnection[connection.id] ??
                          SYNC_DEFAULT_DAYS
                        }
                        disabled={syncingId === connection.id}
                        onChange={(event) =>
                          setSyncDaysByConnection((current) => ({
                            ...current,
                            [connection.id]: Number(event.target.value),
                          }))
                        }
                      >
                        {SYNC_RANGE_OPTIONS.map((option) => (
                          <option key={option.days} value={option.days}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={syncingId === connection.id}
                      onClick={() => void syncBank(connection)}
                    >
                      {syncingId === connection.id ? (
                        <>
                          <span className="loading-spinner" />
                          Syncing…
                        </>
                      ) : (
                        "Sync now"
                      )}
                    </button>
                    <Link
                      href={`/dashboard?bank=${connection.id}`}
                      className="btn btn-secondary"
                    >
                      View dashboard
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="section-title">
          {linkedInstitutions.length > 0
            ? "Connect another bank"
            : "Connect a bank"}
        </h2>
        <p className="page-subtitle" style={{ marginBottom: "1.25rem" }}>
          Choose your bank to authorise read-only access. You&apos;ll be redirected
          to log in securely, then returned here automatically.
        </p>

        {availableInstitutions.length === 0 ? (
          <div className="empty-state card">
            <h3>All available banks connected</h3>
            <p>Head to the dashboard to review your transactions.</p>
          </div>
        ) : (
          <div className="bank-grid">
            {availableInstitutions.map((institution) => (
              <button
                key={institution.id}
                type="button"
                className="bank-card clickable"
                disabled={connectingId === institution.id}
                onClick={() => void connectBank(institution)}
                style={{ textAlign: "left" }}
              >
                <div className="bank-card-header">
                  <BankLogo institution={institution} />
                  <div className="bank-card-info">
                    <p className="bank-name">{institution.name}</p>
                    <p className="bank-meta">
                      {connectingId === institution.id
                        ? "Redirecting to your bank…"
                        : "Click to connect"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
