import { describe, expect, it } from "vitest";
import type { ExternalTransaction } from "@poca/bank-connect";
import {
  descriptionsEquivalent,
  isBookingDateShiftDuplicate,
  normalizeBankDescription,
  preferDescription,
  preferExternalId,
} from "./transaction-duplicates";

function tx(
  overrides: Partial<ExternalTransaction> &
    Pick<ExternalTransaction, "externalId" | "description">,
): ExternalTransaction {
  return {
    amount: -205.46,
    currency: "EUR",
    bookedAt: new Date("2026-09-03T00:00:00.000Z"),
    merchant: undefined,
    ...overrides,
  };
}

describe("standing-order remittance variants", () => {
  it("treats trailing SO as the same payment instruction", () => {
    expect(normalizeBankDescription("TO A/C 85212351    SO")).toBe(
      "TO A/C 85212351",
    );
    expect(
      descriptionsEquivalent("TO A/C 85212351    SO", "TO A/C 85212351"),
    ).toBe(true);
  });

  it("keeps distinct account numbers apart", () => {
    expect(
      descriptionsEquivalent("TO A/C 85212351 SO", "TO A/C 99999999 SO"),
    ).toBe(false);
  });

  it("merges a bank hex id with a synthetic fallback on the same day", () => {
    expect(
      isBookingDateShiftDuplicate(
        tx({
          externalId: "66AF3A1DC58544544608FBB2E49F3C",
          description: "TO A/C 85212351    SO",
        }),
        {
          externalId: "-205.46-TO A/C 85212351-2026-09-03",
          bookedAt: new Date("2026-09-03T00:00:00.000Z"),
          amount: { toString: () => "-205.46" },
          description: "TO A/C 85212351",
        },
      ),
    ).toBe(true);
  });

  it("does not merge two bank hex ids", () => {
    expect(
      isBookingDateShiftDuplicate(
        tx({
          externalId: "66AF3A1DC58544544608FBB2E49F3C",
          description: "TO A/C 85212351    SO",
        }),
        {
          externalId: "ECDA9A86478432981052F32D3D9F27",
          bookedAt: new Date("2026-09-03T00:00:00.000Z"),
          amount: { toString: () => "-205.46" },
          description: "TO A/C 85212351",
        },
      ),
    ).toBe(false);
  });

  it("treats 30-character Bank of Ireland ids as real bank ids", () => {
    expect(
      preferExternalId(
        "-205.46-TO A/C 85212351-2026-09-03",
        "66AF3A1DC58544544608FBB2E49F3C",
      ),
    ).toBe("66AF3A1DC58544544608FBB2E49F3C");
  });

  it("prefers the real bank id and the SO remittance", () => {
    expect(
      preferExternalId(
        "66AF3A1DC58544544608FBB2E49F3C",
        "-205.46-TO A/C 85212351-2026-09-03",
      ),
    ).toBe("66AF3A1DC58544544608FBB2E49F3C");
    expect(preferDescription("TO A/C 85212351", "TO A/C 85212351    SO")).toBe(
      "TO A/C 85212351    SO",
    );
  });
});

describe("POS remittance variants", () => {
  it("treats POS01SEP and 01SEP as the same card payment", () => {
    expect(normalizeBankDescription("POS01SEP PLAYSTATION")).toBe("PLAYSTATION");
    expect(normalizeBankDescription("01SEP PLAYSTATION")).toBe("PLAYSTATION");
    expect(
      descriptionsEquivalent("POS01SEP PLAYSTATION", "01SEP PLAYSTATION"),
    ).toBe(true);
  });

  it("merges a bank hex POS row with a synthetic date-prefix row", () => {
    expect(
      isBookingDateShiftDuplicate(
        tx({
          externalId: "7A2016FC0B854059762196473BFB20",
          description: "POS01SEP PLAYSTATION",
          amount: -15.99,
          bookedAt: new Date("2026-09-02T00:00:00.000Z"),
        }),
        {
          externalId: "-15.99-01SEP PLAYSTATION-2026-09-02",
          bookedAt: new Date("2026-09-02T00:00:00.000Z"),
          amount: { toString: () => "-15.99" },
          description: "01SEP PLAYSTATION",
        },
      ),
    ).toBe(true);
  });

  it("prefers the POS remittance text", () => {
    expect(preferDescription("01SEP PLAYSTATION", "POS01SEP PLAYSTATION")).toBe(
      "POS01SEP PLAYSTATION",
    );
  });
});
