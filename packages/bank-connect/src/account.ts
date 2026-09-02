import type { ExternalAccount, ExternalBalance } from "./types";
import { accountTypeLabel } from "@poca/shared";

const BALANCE_TYPE_RANK: Record<string, number> = {
  ITAV: 0,
  INTERIMAVAILABLE: 0,
  CLAV: 1,
  CLOSINGAVAILABLE: 1,
  XPCD: 2,
  EXPECTED: 2,
  INTERIMBOOKED: 3,
  CLBD: 4,
  CLOSINGBOOKED: 4,
  OPAV: 5,
  OPBD: 6,
  OPENINGBOOKED: 6,
  FWAV: 7,
  FORWARDAVAILABLE: 7,
};

export function buildAccountName(account: {
  name?: string;
  product?: string;
  details?: string;
  cashAccountType?: string;
  currency?: string;
}): string {
  const currency = (account.currency || "EUR").toUpperCase();
  const typeLabel = accountTypeLabel(account.cashAccountType);
  const product = account.product?.trim();
  const details = account.details?.trim();
  const name = account.name?.trim();
  const specific = product || details;

  if (specific) {
    return includesToken(specific, currency) ? specific : `${specific} · ${currency}`;
  }

  if (name && name.toLowerCase() !== typeLabel.toLowerCase()) {
    return includesToken(name, currency) ? name : `${name} · ${currency}`;
  }

  return `${typeLabel} · ${currency}`;
}

export function pickAccountBalance(
  balances: ExternalBalance[],
  accountCurrency?: string,
): { amount: number; currency: string } {
  const currency = (accountCurrency || "EUR").toUpperCase();
  const matching = balances.filter(
    (balance) => (balance.currency || "EUR").toUpperCase() === currency,
  );
  const pool = matching.length > 0 ? matching : balances;

  if (pool.length === 0) {
    return { amount: 0, currency };
  }

  const best = [...pool].sort(
    (left, right) => balanceTypeRank(left.balanceType) - balanceTypeRank(right.balanceType),
  )[0];

  return {
    amount: Number.isFinite(best.amount) ? best.amount : 0,
    currency: (best.currency || currency).toUpperCase(),
  };
}

export function toStoredAccount(account: ExternalAccount): {
  name: string;
  iban?: string;
  currency: string;
  accountType: string | null;
  product: string | null;
} {
  const currency = (account.currency || "EUR").toUpperCase();
  return {
    name: buildAccountName({ ...account, currency }),
    iban: account.iban,
    currency,
    accountType: account.cashAccountType?.trim().toUpperCase() || null,
    product: account.product?.trim() || null,
  };
}

function balanceTypeRank(balanceType?: string): number {
  if (!balanceType) return 50;
  const normalized = balanceType.replace(/[\s_-]/g, "").toUpperCase();
  if (normalized === "INFO") return 90;
  return BALANCE_TYPE_RANK[normalized] ?? 40;
}

function includesToken(value: string, token: string): boolean {
  return value.toUpperCase().includes(token.toUpperCase());
}
