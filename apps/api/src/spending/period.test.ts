import { describe, expect, it } from "vitest";
import { resolveSpendingPeriod } from "@poca/shared";

describe("resolveSpendingPeriod", () => {
  const now = new Date(2026, 8, 3, 12, 0, 0); // 3 September 2026

  it("defaults to the current calendar month", () => {
    const period = resolveSpendingPeriod({}, now);
    expect(period.kind).toBe("month");
    expect(period.year).toBe(2026);
    expect(period.month).toBe(9);
    expect(period.label).toBe("September 2026");
    expect(period.periodStart.getDate()).toBe(1);
    expect(period.periodEnd.getMonth()).toBe(8);
    expect(period.periodEnd.getDate()).toBe(30);
  });

  it("resolves an explicit calendar month, including past months", () => {
    const period = resolveSpendingPeriod({ year: 2026, month: 8 }, now);
    expect(period.kind).toBe("month");
    expect(period.label).toBe("August 2026");
    expect(period.periodStart.getMonth()).toBe(7);
    expect(period.periodEnd.getDate()).toBe(31);
  });

  it("resolves a custom inclusive date range", () => {
    const period = resolveSpendingPeriod(
      { from: "2026-08-11", to: "2026-09-30" },
      now,
    );
    expect(period.kind).toBe("custom");
    expect(period.from).toBe("2026-08-11");
    expect(period.to).toBe("2026-09-30");
    expect(period.periodStart.getDate()).toBe(11);
    expect(period.periodStart.getMonth()).toBe(7);
    expect(period.label).toMatch(/11 Aug 2026/);
  });

  it("does not use rolling 90-day windows for last 3 months", () => {
    const period = resolveSpendingPeriod({ range: "quarter" }, now);
    expect(period.periodStart.getMonth()).toBe(6); // July
    expect(period.periodStart.getDate()).toBe(1);
    expect(period.periodEnd.getMonth()).toBe(8); // September
    expect(period.periodEnd.getDate()).toBe(30);
  });
});
