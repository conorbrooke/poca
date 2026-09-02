import { describe, expect, it } from "vitest";
import { syncDateFrom } from "./stats.js";

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
