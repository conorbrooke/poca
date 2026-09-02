import { describe, expect, it } from "vitest";
import { sumBalancesByCurrency } from "@poca/shared";
import { convertToEur } from "../fx/convert.js";
import { computeStats, syncDateFrom } from "./stats.js";

describe("syncDateFrom", () => {
  it("returns start of today for daysBack 0", () => {
    const now = new Date();
    const from = syncDateFrom(0);
    const parsed = new Date(from);

    expect(parsed.getUTCHours()).toBe(0);
    expect(parsed.getUTCMinutes()).toBe(0);
    expect(parsed.getUTCDate()).toBe(now.getUTCDate());
    expect(parsed.getUTCMonth()).toBe(now.getUTCMonth());
    expect(parsed.getUTCFullYear()).toBe(now.getUTCFullYear());
  });

  it("returns start of the day N days ago", () => {
    const now = new Date();
    const from = syncDateFrom(2);
    const parsed = new Date(from);
    const expected = new Date(now);
    expected.setUTCDate(expected.getUTCDate() - 2);
    expected.setUTCHours(0, 0, 0, 0);

    expect(parsed.toISOString()).toBe(expected.toISOString());
  });
});

describe("computeStats", () => {
  it("converts TRY spending to EUR instead of counting lira as euros", () => {
    const bookedAt = new Date("2026-01-15T12:00:00.000Z");
    const rates = { EUR: 1, TRY: 55 };
    const stats = computeStats(
      [
        { amount: { toString: () => "-20" }, bookedAt, currency: "EUR" },
        { amount: { toString: () => "-110" }, bookedAt, currency: "TRY" },
      ],
      (amount, currency) => convertToEur(amount, currency, rates),
    );

    expect(stats.totalSpent).toBe(22);
  });
});

describe("sumBalancesByCurrency", () => {
  it("does not add TRY into EUR", () => {
    expect(
      sumBalancesByCurrency([
        { currentBalance: 0.3, currency: "EUR" },
        { currentBalance: 0.01, currency: "EUR" },
        { currentBalance: 2, currency: "TRY" },
      ]),
    ).toEqual([
      { currency: "EUR", amount: 0.31 },
      { currency: "TRY", amount: 2 },
    ]);
  });
});
