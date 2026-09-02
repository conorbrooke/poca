import { describe, expect, it } from "vitest";
import {
  buildFallbackExternalId,
  isLegacySyntheticExternalId,
} from "./transaction-id.js";

describe("buildFallbackExternalId", () => {
  it("uses value date so booking date shifts keep the same id", () => {
    const idPending = buildFallbackExternalId(
      -16,
      "21AUG PAULS BARBERSH",
      "2026-08-21",
    );
    const idPosted = buildFallbackExternalId(
      -16,
      "21AUG PAULS BARBERSH",
      "2026-08-21",
    );

    expect(idPending).toBe("-16-21AUG PAULS BARBERSH-2026-08-21");
    expect(idPosted).toBe(idPending);
  });

  it("distinguishes separate purchases on different value dates", () => {
    const first = buildFallbackExternalId(-16, "21AUG PAULS BARBERSH", "2026-08-21");
    const second = buildFallbackExternalId(-16, "28AUG PAULS BARBERSH", "2026-08-28");

    expect(first).not.toBe(second);
  });
});

describe("isLegacySyntheticExternalId", () => {
  it("detects old date-prefixed ids", () => {
    expect(
      isLegacySyntheticExternalId("2026-08-21--16-21AUG PAULS BARBERSH"),
    ).toBe(true);
    expect(
      isLegacySyntheticExternalId("-16-21AUG PAULS BARBERSH-2026-08-21"),
    ).toBe(false);
  });
});
