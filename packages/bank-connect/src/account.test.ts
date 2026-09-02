import { describe, expect, it } from "vitest";
import {
  buildAccountName,
  pickAccountBalance,
  toStoredAccount,
} from "./account.js";
import { accountTypeLabel } from "@poca/shared";

describe("pickAccountBalance", () => {
  it("uses the account currency instead of a EUR balance on another pocket", () => {
    const picked = pickAccountBalance(
      [
        { amount: 4.31, currency: "EUR", balanceType: "CLBD" },
        { amount: 2, currency: "TRY", balanceType: "ITAV" },
      ],
      "TRY",
    );

    expect(picked).toEqual({ amount: 2, currency: "TRY" });
  });

  it("prefers available balance over booked when both are the same currency", () => {
    const picked = pickAccountBalance(
      [
        { amount: 10, currency: "EUR", balanceType: "CLBD" },
        { amount: 0.3, currency: "EUR", balanceType: "ITAV" },
      ],
      "EUR",
    );

    expect(picked).toEqual({ amount: 0.3, currency: "EUR" });
  });

  it("returns zero when the bank sent no balances", () => {
    expect(pickAccountBalance([], "EUR")).toEqual({ amount: 0, currency: "EUR" });
  });
});

describe("buildAccountName", () => {
  it("labels savings vs current with currency", () => {
    expect(
      buildAccountName({
        cashAccountType: "SVGS",
        currency: "EUR",
      }),
    ).toBe("Savings · EUR");

    expect(
      buildAccountName({
        cashAccountType: "CACC",
        name: "Current account",
        currency: "EUR",
      }),
    ).toBe("Current account · EUR");
  });

  it("keeps the bank product name when present", () => {
    expect(
      buildAccountName({
        product: "Turkish Lira",
        cashAccountType: "CACC",
        currency: "TRY",
      }),
    ).toBe("Turkish Lira · TRY");
  });
});

describe("toStoredAccount", () => {
  it("maps Enable Banking account metadata", () => {
    expect(
      toStoredAccount({
        id: "acc-1",
        name: "Personal",
        cashAccountType: "svgs",
        product: "Savings",
        currency: "eur",
      }),
    ).toEqual({
      name: "Savings · EUR",
      iban: undefined,
      currency: "EUR",
      accountType: "SVGS",
      product: "Savings",
    });
  });
});

describe("accountTypeLabel", () => {
  it("maps ISO cash account types", () => {
    expect(accountTypeLabel("CACC")).toBe("Current");
    expect(accountTypeLabel("SVGS")).toBe("Savings");
    expect(accountTypeLabel("CARD")).toBe("Card");
  });
});
