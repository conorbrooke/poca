import { describe, expect, it } from "vitest";
import {
  afterDirt,
  emergencyFundTarget,
  holdingGain,
  monthlyFromCadence,
  remainingBudget,
  savingsRate,
  sortAvalanche,
  sortSnowball,
} from "@poca/shared";
import { normalizeIban } from "@poca/shared";

describe("normalizeIban", () => {
  it("strips spaces and uppercases", () => {
    expect(normalizeIban("ie64 irce 9205 0112 3456 78")).toBe(
      "IE64IRCE92050112345678",
    );
  });
});

describe("wealth math", () => {
  it("computes savings rate from income and spending", () => {
    expect(savingsRate(3000, 2100)).toBe(30);
    expect(savingsRate(0, 100)).toBe(0);
  });

  it("applies DIRT to deposit interest", () => {
    expect(afterDirt(100)).toBe(67);
  });

  it("converts bill cadence to a monthly amount", () => {
    expect(monthlyFromCadence(50, "WEEKLY")).toBe(216.67);
    expect(monthlyFromCadence(1200, "YEARLY")).toBe(100);
    expect(monthlyFromCadence(80, "MONTHLY")).toBe(80);
  });

  it("targets an emergency fund from essential bills", () => {
    expect(emergencyFundTarget(900, 3)).toBe(2700);
  });

  it("computes budget remaining", () => {
    expect(remainingBudget(400, 125.5)).toBe(274.5);
  });

  it("orders debts avalanche then snowball", () => {
    const debts = [
      { id: "a", name: "Card", balance: 800, interestRate: 0.18 },
      { id: "b", name: "Car", balance: 4000, interestRate: 0.07 },
      { id: "c", name: "Friend", balance: 200, interestRate: null },
    ];
    expect(sortAvalanche(debts).map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(sortSnowball(debts).map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("computes holding gain", () => {
    expect(holdingGain(10, 12, 15)).toBe(30);
  });
});
