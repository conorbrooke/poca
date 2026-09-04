"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IRISH_BILL_PRESETS, spendingPeriodLabel } from "@poca/shared";
import { apiFetch } from "../../../../lib/api";
import { formatDate, formatMoney } from "../../../../lib/format";
import { useSpendingPeriod } from "../../../../lib/spending-period";

type Payee = {
  id: string | null;
  categoryId: string;
  categoryName: string;
  color: string;
  icon: string | null;
  cadence: string;
  isEssential: boolean;
  payeeLabel: string;
  status: "paid" | "not_paid" | "not_seen" | "needs_confirm";
  thisMonthSpend: number;
  thisMonthCount: number;
  expected: number;
  lastPayDate: string | null;
  lastMonthTotal: number;
  likelyPayDate: string | null;
};

type BillGroup = {
  categoryId: string;
  name: string;
  color: string;
  icon: string | null;
  cadence: string;
  isEssential: boolean;
  spentThisMonth: number;
  expected: number;
  paidCount: number;
  dueCount: number;
  payees: Payee[];
};

type BillsResponse = {
  year: number;
  month: number;
  calendarNote: string | null;
  categories: BillGroup[];
  needsConfirm: Payee[];
  notSeenLastMonth: Payee[];
  likelyPayDays: Array<{
    payeeLabel: string;
    categoryName: string;
    date: string;
    expected: number;
    isEssential: boolean;
  }>;
  paidSpend: number;
  expectedDue: number;
  essentialExpected: number;
};

function statusLabel(status: Payee["status"]) {
  if (status === "paid") return "Paid";
  if (status === "not_paid") return "Not paid";
  if (status === "not_seen") return "Not seen last month";
  return "Needs confirm";
}

export function BillsClient() {
  const { period, queryString } = useSpendingPeriod();
  const suffix = queryString ? `?${queryString}` : "";
  const [data, setData] = useState<BillsResponse | null>(null);
  const [suggestions, setSuggestions] = useState<
    Array<{ name: string; typicalAmount: number; payeeMatch: string; count: number }>
  >([]);
  const [name, setName] = useState("");
  const [essential, setEssential] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  async function reload() {
    const [list, suggested] = await Promise.all([
      apiFetch<BillsResponse>(`/wealth/bills${suffix}`),
      apiFetch<typeof suggestions>("/wealth/bills/suggestions"),
    ]);
    setData(list);
    setSuggestions(suggested);
  }

  useEffect(() => {
    void reload().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load bills");
    });
  }, [queryString]);

  async function create(
    billName = name,
    isEssential = essential,
    cadence: "WEEKLY" | "MONTHLY" | "YEARLY" = "MONTHLY",
  ) {
    const trimmed = billName.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await apiFetch("/wealth/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          cadence,
          isEssential,
        }),
      });
      setName("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add bill");
    }
  }

  async function toggleEssential(group: BillGroup) {
    await apiFetch(`/wealth/bills/${group.categoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: group.name,
        cadence: group.cadence,
        isEssential: !group.isEssential,
      }),
    });
    await reload();
  }

  async function remove(id: string) {
    await apiFetch(`/wealth/bills/${id}`, { method: "DELETE" });
    await reload();
  }

  async function setPayee(payee: Payee, status: "CONFIRMED" | "IGNORED") {
    await apiFetch("/wealth/bills/payees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: payee.categoryId,
        payeeLabel: payee.payeeLabel,
        status,
      }),
    });
    await reload();
  }

  const monthLabel = spendingPeriodLabel(period);
  const essentialGroups = data?.categories.filter((row) => row.isEssential) ?? [];
  const flexibleGroups = data?.categories.filter((row) => !row.isEssential) ?? [];

  function renderGroup(group: BillGroup) {
    const expanded = open[group.categoryId] ?? true;
    return (
      <div key={group.categoryId} className="card" style={{ marginBottom: "0.75rem" }}>
        <div className="spending-category-row" style={{ border: "none", padding: 0 }}>
          <div>
            <p className="spending-category-name">
              {group.icon ? `${group.icon} ` : ""}
              {group.name}
            </p>
            <p className="bank-meta">
              {group.paidCount} paid · {group.dueCount} not paid
              {group.isEssential ? " · essential" : " · flexible"}
            </p>
          </div>
          <p className="spending-category-amount">{formatMoney(group.spentThisMonth)}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              setOpen((current) => ({
                ...current,
                [group.categoryId]: !expanded,
              }))
            }
          >
            {expanded ? "Hide payees" : "Show payees"}
          </button>
          <Link href={`/spending/${group.categoryId}${suffix}`} className="btn btn-secondary">
            Transactions
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void toggleEssential(group)}
          >
            {group.isEssential ? "Not essential" : "Mark essential"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void remove(group.categoryId)}
          >
            Unmark
          </button>
        </div>
        {expanded ? (
          <div style={{ marginTop: "0.75rem" }}>
            {group.payees.length === 0 ? (
              <p className="bank-meta">No confirmed payees on this month’s list.</p>
            ) : (
              group.payees.map((payee) => (
                <div key={`${payee.categoryId}-${payee.payeeLabel}`} className="spending-category-row">
                  <div>
                    <p className="spending-category-name">{payee.payeeLabel}</p>
                    <p className="bank-meta">
                      {statusLabel(payee.status)}
                      {payee.lastPayDate
                        ? ` · last paid ${formatDate(payee.lastPayDate)}`
                        : ""}
                      {payee.expected > 0
                        ? ` · expected ${formatMoney(payee.expected)}`
                        : ""}
                    </p>
                  </div>
                  <p className="spending-category-amount">
                    {payee.status === "paid" ? formatMoney(payee.thisMonthSpend) : statusLabel(payee.status)}
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void setPayee(payee, "IGNORED")}
                  >
                    Ignore
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="section-title">Recurring bills</h2>
        <p className="bank-meta" style={{ maxWidth: "62ch" }}>
          Paid or not paid this calendar month. Expected is the median of the last
          three payments for that payee. Confirmed monthly payees stay on the list
          after a skipped month, and in their first month. Confirm a new payee to
          put it here. Yearly bills only in the month they hit.
        </p>
        {data?.calendarNote ? (
          <p className="bank-meta" style={{ marginTop: "0.5rem" }}>
            {data.calendarNote}
          </p>
        ) : null}
        <p className="bank-meta" style={{ marginTop: "0.5rem" }}>
          {monthLabel}: {formatMoney(data?.paidSpend ?? 0)} paid
          {data && data.expectedDue > 0
            ? ` · ${data.categories.reduce((sum, row) => sum + row.dueCount, 0)} still to see`
            : ""}
          . Emergency target uses 3× essential expected ({formatMoney(data?.essentialExpected ?? 0)}).
        </p>
        <div className="tag-chip-row" style={{ marginTop: "0.75rem" }}>
          {IRISH_BILL_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="tag-chip"
              onClick={() =>
                void create(preset.name, preset.essential, preset.cadence)
              }
            >
              {preset.name}
            </button>
          ))}
        </div>
        <div className="tag-chip-row" style={{ marginTop: "0.75rem" }}>
          <input
            className="login-input"
            placeholder="New bill category"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <label className="bank-meta">
            <input
              type="checkbox"
              checked={essential}
              onChange={(event) => setEssential(event.target.checked)}
            />{" "}
            Essential
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void create()}
          >
            Add bill category
          </button>
        </div>
      </div>

      {data?.likelyPayDays.length ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 className="section-title">Likely pay days</h2>
          <p className="bank-meta" style={{ marginBottom: "0.5rem" }}>
            Last month’s pay date mapped onto this month — not a due date.
          </p>
          {data.likelyPayDays.map((row) => (
            <p key={`${row.categoryName}-${row.payeeLabel}`} className="bank-meta">
              {formatDate(row.date)} · {row.payeeLabel} ({row.categoryName})
              {row.expected > 0 ? ` · ${formatMoney(row.expected)}` : ""}
            </p>
          ))}
        </div>
      ) : null}

      {data?.needsConfirm.length ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 className="section-title">Confirm new payees</h2>
          <p className="bank-meta" style={{ marginBottom: "0.5rem" }}>
            These showed up in a bill category this month. Confirm to put them
            on this month’s list even if it is the first time, or ignore if it
            is not a bill.
          </p>
          {data.needsConfirm.map((payee) => (
            <div key={`${payee.categoryId}-${payee.payeeLabel}`} className="spending-category-row">
              <div>
                <p className="spending-category-name">{payee.payeeLabel}</p>
                <p className="bank-meta">
                  {payee.categoryName} · {formatMoney(payee.thisMonthSpend)} this month
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void setPayee(payee, "CONFIRMED")}
              >
                Confirm
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void setPayee(payee, "IGNORED")}
              >
                Ignore
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <h2 className="section-title">Essential</h2>
      {essentialGroups.length === 0 ? (
        <p className="bank-meta" style={{ marginBottom: "1rem" }}>
          No essential bills on this month’s list.
        </p>
      ) : (
        essentialGroups.map(renderGroup)
      )}

      <h2 className="section-title">Flexible</h2>
      {flexibleGroups.length === 0 ? (
        <p className="bank-meta" style={{ marginBottom: "1rem" }}>
          No flexible bills on this month’s list.
        </p>
      ) : (
        flexibleGroups.map(renderGroup)
      )}

      {data && data.notSeenLastMonth.length > 0 ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h2 className="section-title">Not seen last month</h2>
          <p className="bank-meta" style={{ marginBottom: "0.5rem" }}>
            Yearly bills sit here until their month. Confirmed monthly payees
            stay on the list above even if last month was blank.
          </p>
          {data.notSeenLastMonth.map((payee) => (
            <div key={`${payee.categoryId}-${payee.payeeLabel}`} className="spending-category-row">
              <div>
                <p className="spending-category-name">{payee.payeeLabel}</p>
                <p className="bank-meta">
                  {payee.categoryName}
                  {payee.lastPayDate ? ` · last paid ${formatDate(payee.lastPayDate)}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void setPayee(payee, "IGNORED")}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h2 className="section-title">Seen often in the last 90 days</h2>
          <p className="bank-meta" style={{ marginBottom: "0.5rem" }}>
            If these are really bills, add a category and recategorise the
            transactions.
          </p>
          {suggestions.map((row) => (
            <div key={row.payeeMatch} className="spending-category-row">
              <div>
                <p className="spending-category-name">{row.name}</p>
                <p className="bank-meta">
                  {row.count} times · avg {formatMoney(row.typicalAmount)}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void create(row.name, true)}
              >
                Make bill category
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
