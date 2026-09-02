import { describe, expect, it } from "vitest";
import { matchTransferPairs } from "./transfer-matching";

describe("matchTransferPairs", () => {
  const day = (offset: number) =>
    new Date(`2026-01-${String(10 + offset).padStart(2, "0")}T12:00:00Z`);

  it("pairs opposite amounts on different accounts within the window", () => {
    const matches = matchTransferPairs(
      [{ id: "out-1", accountId: "a1", amount: -500, bookedAt: day(0) }],
      [{ id: "in-1", accountId: "a2", amount: 500, bookedAt: day(1) }],
    );

    expect(matches).toEqual([
      { outId: "out-1", inId: "in-1", confidence: "medium" },
    ]);
  });

  it("skips same-account candidates and already-linked ids", () => {
    const matches = matchTransferPairs(
      [{ id: "out-1", accountId: "a1", amount: -200, bookedAt: day(0) }],
      [
        { id: "in-same", accountId: "a1", amount: 200, bookedAt: day(0) },
        { id: "in-used", accountId: "a2", amount: 200, bookedAt: day(0) },
      ],
      { linkedInIds: new Set(["in-used"]) },
    );

    expect(matches).toEqual([]);
  });

  it("prefers the closest inflow date", () => {
    const matches = matchTransferPairs(
      [{ id: "out-1", accountId: "a1", amount: -100, bookedAt: day(0) }],
      [
        { id: "in-far", accountId: "a2", amount: 100, bookedAt: day(3) },
        { id: "in-near", accountId: "a2", amount: 100, bookedAt: day(0) },
      ],
    );

    expect(matches[0]?.inId).toBe("in-near");
  });

  it("marks high confidence when transfer category and same-day", () => {
    const matches = matchTransferPairs(
      [
        {
          id: "out-1",
          accountId: "a1",
          amount: -300,
          bookedAt: day(0),
          categoryKind: "TRANSFER",
        },
      ],
      [
        {
          id: "in-1",
          accountId: "a2",
          amount: 300,
          bookedAt: day(0),
          categoryKind: "INCOME",
        },
      ],
    );

    expect(matches[0]?.confidence).toBe("high");
  });
});
