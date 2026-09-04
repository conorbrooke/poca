import { describe, expect, it } from "vitest";
import {
  afterDirt,
  amortiseRemaining,
  billPayeeOnChecklist,
  budgetMonthFromPeriod,
  chartWindowFromFocus,
  depreciatedValue,
  emergencyFundTarget,
  holdingGain,
  isBillPayeePaid,
  medianAmount,
  monthlyFromCadence,
  monthlyPensionInflow,
  monthSurplus,
  myFutureFundMonthlyFromGross,
  remainingBudget,
  roundCents,
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

  it("picks the calendar month from a resolved period", () => {
    expect(
      budgetMonthFromPeriod({
        kind: "month",
        periodStart: new Date(2026, 8, 1),
        periodEnd: new Date(2026, 8, 30, 23, 59, 59, 999),
        label: "September 2026",
        cacheKey: "month",
        year: 2026,
        month: 9,
      }),
    ).toEqual({ year: 2026, month: 9 });
  });

  it("sums monthly pension inflows, falling back to annual match / 12", () => {
    expect(
      monthlyPensionInflow({
        employeeContributionMonthly: 45,
        employerContributionMonthly: 45,
        stateContributionMonthly: 15,
      }),
    ).toBe(105);
    expect(monthlyPensionInflow({ employerMatchAnnual: 1200 })).toBe(100);
  });

  it("computes 2026 MyFutureFund monthly amounts from gross pay", () => {
    expect(myFutureFundMonthlyFromGross(4000)).toEqual({
      employee: 60,
      employer: 60,
      state: 20,
      total: 140,
    });
  });

  it("takes the median of the last payment amounts", () => {
    expect(medianAmount([10, 30, 20])).toBe(20);
    expect(medianAmount([10, 20])).toBe(15);
    expect(medianAmount([])).toBe(0);
  });

  it("marks a payee paid when this month meets expected", () => {
    expect(isBillPayeePaid(80, 80)).toBe(true);
    expect(isBillPayeePaid(79.99, 80)).toBe(false);
    expect(isBillPayeePaid(10, 0)).toBe(true);
  });

  it("puts yearly bills on the checklist only in the hit month", () => {
    expect(
      billPayeeOnChecklist({
        cadence: "YEARLY",
        lastMonthTotal: 0,
        lastOccurrenceMonth: 3,
        focusMonth: 3,
      }),
    ).toBe(true);
    expect(
      billPayeeOnChecklist({
        cadence: "YEARLY",
        lastMonthTotal: 0,
        lastOccurrenceMonth: 3,
        focusMonth: 8,
      }),
    ).toBe(false);
    expect(
      billPayeeOnChecklist({
        cadence: "MONTHLY",
        lastMonthTotal: 205,
        lastOccurrenceMonth: 7,
        focusMonth: 8,
      }),
    ).toBe(true);
  });

  it("carries last month surplus after spending and loan transfers", () => {
    expect(monthSurplus(3000, 2200, 205)).toBe(595);
    expect(monthSurplus(2000, 2200, 0)).toBe(-200);
  });

  it("reduces a loan by principal after monthly interest", () => {
    expect(amortiseRemaining(6500, 0.005, [{ amount: 205 }])).toBe(6327.5);
  });

  it("flex spending is all expenses minus paid bill payees", () => {
    expect(roundCents(1400 - 420)).toBe(980);
  });

  it("depreciates an opening car value yearly", () => {
    const start = new Date("2024-09-04T12:00:00");
    const asOf = new Date("2025-09-04T12:00:00");
    expect(depreciatedValue(20000, 0.15, start, asOf)).toBe(17001.89);
  });

  it("charts the focused month plus the three months before it", () => {
    const window = chartWindowFromFocus(2026, 8, new Date(2026, 7, 20, 12));
    expect(window.start.getFullYear()).toBe(2026);
    expect(window.start.getMonth()).toBe(4);
    expect(window.start.getDate()).toBe(1);
    expect(window.end.getFullYear()).toBe(2026);
    expect(window.end.getMonth()).toBe(7);
    expect(window.end.getDate()).toBe(20);
  });
});
