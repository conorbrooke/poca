import { describe, expect, it } from "vitest";
import { convertToEur, normalizeRateMap } from "./convert";

const rates = normalizeRateMap({ try: 55, usd: 1.1, eur: 1 });

describe("convertToEur", () => {
  it("leaves EUR amounts unchanged", () => {
    expect(convertToEur(-12.34, "EUR", rates)).toBe(-12.34);
    expect(convertToEur(20, "eur", rates)).toBe(20);
  });

  it("divides foreign amounts by units per euro", () => {
    expect(convertToEur(-110, "TRY", rates)).toBe(-2);
    expect(convertToEur(110, "try", rates)).toBe(2);
  });

  it("does not treat TRY 110 as 110 euros", () => {
    expect(Math.abs(convertToEur(-110, "TRY", rates))).toBeLessThan(10);
  });

  it("falls back to the original amount when the rate is missing", () => {
    expect(convertToEur(-5, "GBP", rates)).toBe(-5);
  });
});
