"use client";

import { useEffect, useState } from "react";
import {
  currentCalendarMonth,
  formatDateOnly,
  formatMonthLabel,
  monthEnd,
  monthStart,
  shiftCalendarMonth,
  spendingPeriodLabel,
  type ClientSpendingPeriod,
} from "@poca/shared";

type PeriodPickerProps = {
  period: ClientSpendingPeriod;
  onChange: (period: ClientSpendingPeriod) => void;
};

export function PeriodPicker({ period, onChange }: PeriodPickerProps) {
  const current = currentCalendarMonth();
  const month =
    period.kind === "month"
      ? period
      : period.kind === "custom"
        ? {
            kind: "month" as const,
            year: Number(period.to.slice(0, 4)),
            month: Number(period.to.slice(5, 7)),
          }
        : current;
  const [draftFrom, setDraftFrom] = useState(
    period.kind === "custom" ? period.from : formatDateOnly(monthStart(month.year, month.month)),
  );
  const [draftTo, setDraftTo] = useState(
    period.kind === "custom" ? period.to : formatDateOnly(monthEnd(month.year, month.month)),
  );

  useEffect(() => {
    if (period.kind === "custom") {
      setDraftFrom(period.from);
      setDraftTo(period.to);
    }
  }, [period]);

  function selectMonth(year: number, monthNumber: number) {
    onChange({ kind: "month", year, month: monthNumber });
  }

  function shiftMonth(delta: number) {
    const next = shiftCalendarMonth(month.year, month.month, delta);
    selectMonth(next.year, next.month);
  }

  function selectCustom() {
    const from =
      period.kind === "custom"
        ? period.from
        : formatDateOnly(monthStart(month.year, month.month));
    const to =
      period.kind === "custom"
        ? period.to
        : formatDateOnly(monthEnd(month.year, month.month));
    setDraftFrom(from);
    setDraftTo(to);
    onChange({ kind: "custom", from, to });
  }

  function applyCustom(from: string, to: string) {
    setDraftFrom(from);
    setDraftTo(to);
    if (!from || !to) return;
    onChange({
      kind: "custom",
      from: from <= to ? from : to,
      to: from <= to ? to : from,
    });
  }

  return (
    <div className="period-picker">
      <div className="range-tabs">
        <button
          type="button"
          className={`range-tab${period.kind === "month" ? " active" : ""}`}
          onClick={() => selectMonth(month.year, month.month)}
        >
          Month
        </button>
        <button
          type="button"
          className={`range-tab${period.kind === "custom" ? " active" : ""}`}
          onClick={selectCustom}
        >
          Custom range
        </button>
        <button
          type="button"
          className={`range-tab${period.kind === "all" ? " active" : ""}`}
          onClick={() => onChange({ kind: "all" })}
        >
          All time
        </button>
      </div>

      {period.kind === "month" ? (
        <div className="period-month-row">
          <div className="range-tabs" style={{ marginBottom: 0 }}>
            <button type="button" className="range-tab" onClick={() => shiftMonth(-1)}>
              Previous
            </button>
            <span className="range-tab active">
              {formatMonthLabel(period.year, period.month)}
            </span>
            <button type="button" className="range-tab" onClick={() => shiftMonth(1)}>
              Next
            </button>
          </div>
          {period.year !== current.year || period.month !== current.month ? (
            <button
              type="button"
              className="range-tab"
              onClick={() => selectMonth(current.year, current.month)}
            >
              This month
            </button>
          ) : null}
        </div>
      ) : null}

      {period.kind === "custom" ? (
        <div className="period-custom-row">
          <label className="login-label">
            From
            <input
              type="date"
              className="login-input"
              value={draftFrom}
              onChange={(event) => applyCustom(event.target.value, draftTo)}
            />
          </label>
          <label className="login-label">
            To
            <input
              type="date"
              className="login-input"
              value={draftTo}
              onChange={(event) => applyCustom(draftFrom, event.target.value)}
            />
          </label>
          <p className="bank-meta period-custom-hint">
            Pick any inclusive dates — e.g. late August plus all of September.
          </p>
        </div>
      ) : null}

      {period.kind === "all" ? (
        <p className="bank-meta">Every transaction on file.</p>
      ) : period.kind === "custom" ? (
        <p className="bank-meta period-current-label">
          Showing {spendingPeriodLabel(period)}
        </p>
      ) : null}
    </div>
  );
}
