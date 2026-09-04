"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { formatMoneyList, formatRelativeSync } from "../../../lib/format";
import type {
  BankConnection,
  Institution,
  LinkResponse,
  SyncResponse,
} from "../../../lib/types";
import {
  REVOLUT_HISTORY_WARNING,
  SYNC_DEFAULT_DAYS,
  SYNC_MAX_DAYS,
  SYNC_RANGE_OPTIONS,
  accountTypeLabel,
  isRevolutInstitution,
  sumBalancesByCurrency,
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
  const searchParams = useSearchParams();
  const connectedId = searchParams.get("connected");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
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
      institutions.filter((inst) => {
        const connection = connectionByInstitution.get(inst.id);
        return !connection || connection.status !== "LINKED";
      }),
    [institutions, connectionByInstitution],
  );

  function bankRedirectUrl() {
    const configured = process.env.NEXT_PUBLIC_BANK_REDIRECT_URL?.trim();
    if (configured) return configured;
    return `${window.location.origin}/bank/callback`;
  }

  async function resumeConnection(connection: BankConnection) {
    setResumingId(connection.id);
    setError(null);
    setMessage(null);

    try {
      const path =
        connection.status === "LINKED"
          ? `/bank/connections/${connection.id}/reconnect`
          : `/bank/connections/${connection.id}/resume`;
      const result = await apiFetch<LinkResponse>(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirectUrl: bankRedirectUrl() }),
      });
      window.location.href = result.link;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume bank link");
      setResumingId(null);
    }
  }

  async function removeConnection(connection: BankConnection, wipe = false) {
    const label =
      connection.status === "PENDING"
        ? `Remove the unfinished ${connection.institutionName} connection?`
        : wipe
          ? `Permanently delete ${connection.institutionName} from Póca? This removes its accounts and every transaction for that bank.`
          : `Disconnect ${connection.institutionName}? Transactions stay in Póca. Reconnect later to resume sync.`;

    if (!window.confirm(label)) return;
    if (wipe && !window.confirm("Type-level confirm: this cannot be undone. Delete history?")) {
      return;
    }

    setRemovingId(connection.id);
    setError(null);
    setMessage(null);

    try {
      const query = wipe ? "?wipe=true" : "";
      await apiFetch(`/bank/connections/${connection.id}${query}`, {
        method: "DELETE",
      });
      setMessage(
        wipe
          ? `${connection.institutionName} and its history were deleted.`
          : `${connection.institutionName} disconnected. Transactions were kept.`,
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove bank");
    } finally {
      setRemovingId(null);
    }
  }

  async function connectBank(institution: Institution) {
    setConnectingId(institution.id);
    setError(null);
    setMessage(null);

    try {
      const result = await apiFetch<LinkResponse>("/bank/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId: institution.id,
          redirectUrl: bankRedirectUrl(),
        }),
      });

      window.location.href = result.link;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start bank link");
      setConnectingId(null);
    }
  }

  async function syncBank(connection: BankConnection, overrideDaysBack?: number) {
    setSyncingId(connection.id);
    setError(null);
    setMessage(null);

    const daysBack =
      overrideDaysBack ??
      syncDaysByConnection[connection.id] ??
      SYNC_DEFAULT_DAYS;

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

  const justConnectedRevolut = useMemo(() => {
    if (!connectedId) return null;
    const connection = connections.find((item) => item.id === connectedId);
    if (!connection) return null;
    return isRevolutInstitution(
      connection.institutionId,
      connection.institutionName,
    )
      ? connection
      : null;
  }, [connectedId, connections]);

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

      {justConnectedRevolut ? (
        <div className="alert alert-warning revolut-history-banner">
          <p>
            <strong>Revolut connected.</strong> {REVOLUT_HISTORY_WARNING}
          </p>
          <div className="tag-chip-row" style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={syncingId === justConnectedRevolut.id}
              onClick={() => void syncBank(justConnectedRevolut, SYNC_MAX_DAYS)}
            >
              {syncingId === justConnectedRevolut.id ? (
                <>
                  <span className="loading-spinner" />
                  Syncing last year…
                </>
              ) : (
                "Sync last year now"
              )}
            </button>
            <Link href="/dashboard" className="btn btn-secondary">
              Skip for now
            </Link>
          </div>
        </div>
      ) : null}

      {linkedInstitutions.length > 0 ? (
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 className="section-title">Your banks</h2>
          <div className="bank-grid">
            {linkedInstitutions.map((institution) => {
              const connection = connectionByInstitution.get(institution.id)!;
              const isPending = connection.status === "PENDING";
              const isBusy =
                syncingId === connection.id ||
                removingId === connection.id ||
                resumingId === connection.id;
              const balances = sumBalancesByCurrency(connection.accounts);
              const txCount = connection.accounts.reduce(
                (sum, account) => sum + account.transactionCount,
                0,
              );
              const isRevolut = isRevolutInstitution(
                connection.institutionId,
                connection.institutionName,
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
                        {formatMoneyList(balances)} · {txCount} transactions ·{" "}
                        {formatRelativeSync(connection.lastSyncedAt)}
                      </p>
                      {connection.accounts.length > 1 ? (
                        <p className="bank-meta">
                          {connection.accounts
                            .map(
                              (account) =>
                                `${accountTypeLabel(account.accountType)} ${account.currency}`,
                            )
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {connection.lastError ? (
                    <p className="alert alert-error" style={{ margin: 0 }}>
                      {connection.lastError}
                    </p>
                  ) : null}

                  {isPending ? (
                    <div className="alert alert-warning" style={{ margin: 0 }}>
                      Authorisation was started but not finished. Continue setup
                      with {connection.institutionName}, or remove this connection
                      and try again.
                    </div>
                  ) : null}

                  {isRevolut && !isPending ? (
                    <p className="bank-meta revolut-history-note">
                      {REVOLUT_HISTORY_WARNING}
                    </p>
                  ) : null}

                  <div className="bank-card-actions">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={isBusy}
                          onClick={() => void resumeConnection(connection)}
                        >
                          {resumingId === connection.id ? (
                            <>
                              <span className="loading-spinner" />
                              Redirecting…
                            </>
                          ) : (
                            "Continue authorisation"
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={isBusy}
                          onClick={() => void removeConnection(connection)}
                        >
                          {removingId === connection.id ? "Removing…" : "Remove"}
                        </button>
                      </>
                    ) : (
                      <>
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
                    {isRevolut ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={syncingId === connection.id}
                        onClick={() => void syncBank(connection, SYNC_MAX_DAYS)}
                      >
                        Sync last year
                      </button>
                    ) : null}
                    <Link
                      href={`/dashboard?bank=${connection.id}`}
                      className="btn btn-secondary"
                    >
                      View dashboard
                    </Link>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={isBusy}
                      onClick={() => void resumeConnection(connection)}
                    >
                      {resumingId === connection.id
                        ? "Redirecting…"
                        : "Add accounts"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={isBusy}
                      onClick={() => void removeConnection(connection)}
                    >
                      {removingId === connection.id ? "Disconnecting…" : "Disconnect"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={isBusy}
                      onClick={() => void removeConnection(connection, true)}
                    >
                      Delete history
                    </button>
                      </>
                    )}
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
            {availableInstitutions.map((institution) => {
              const isRevolut = isRevolutInstitution(
                institution.id,
                institution.name,
              );

              return (
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
                    {isRevolut ? (
                      <p className="bank-meta revolut-history-note">
                        After you approve, you&apos;ll have about 5 minutes to
                        sync a full year of history.
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
