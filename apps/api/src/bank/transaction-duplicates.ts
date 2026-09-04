import type { ExternalTransaction } from "@poca/bank-connect";

const PAYMENT_TYPE_SUFFIX = /(?:\s+(?:SO|DD|ST|CR))+$/i;

export function isBankHexId(externalId: string) {
  return /^[0-9A-F]{16,64}$/i.test(externalId);
}

export function isLegacySyntheticId(externalId: string) {
  return /^\d{4}-\d{2}-\d{2}-/.test(externalId);
}

/** Fallback IDs we generate when the bank omits entry_reference / transaction_id. */
export function isFallbackSyntheticId(externalId: string) {
  return isLegacySyntheticId(externalId) || /^-?\d+(\.\d+)?-/.test(externalId);
}

export function normalizeBankDescription(description: string) {
  return description
    .replace(/\s+/g, " ")
    .trim()
    .replace(PAYMENT_TYPE_SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function descriptionsEquivalent(left: string, right: string) {
  return normalizeBankDescription(left) === normalizeBankDescription(right);
}

export function preferExternalId(next: string, current: string | null) {
  if (!current) return next;
  const nextBank = isBankHexId(next);
  const currentBank = isBankHexId(current);
  if (nextBank && !currentBank) return next;
  if (!nextBank && currentBank) return current;
  const nextLegacy = isLegacySyntheticId(next);
  const currentLegacy = isLegacySyntheticId(current);
  if (currentLegacy && !nextLegacy) return next;
  if (!currentLegacy && nextLegacy) return current;
  return next;
}

export function preferDescription(left: string, right: string) {
  const leftHasSuffix = PAYMENT_TYPE_SUFFIX.test(left.trim());
  const rightHasSuffix = PAYMENT_TYPE_SUFFIX.test(right.trim());
  if (leftHasSuffix && !rightHasSuffix) return left;
  if (!leftHasSuffix && rightHasSuffix) return right;
  return left.length >= right.length ? left : right;
}

type StoredTx = {
  externalId: string | null;
  bookedAt: Date;
  amount: { toString(): string };
  description: string;
};

/**
 * Detect the same bank row reappearing with a shifted booking date (pending → posted)
 * or a standing-order remittance variant (`TO A/C 123 SO` vs `TO A/C 123`).
 * Never merges two bank hex IDs.
 */
export function isBookingDateShiftDuplicate(
  incoming: ExternalTransaction,
  existing: StoredTx,
) {
  if (existing.externalId === incoming.externalId) return false;

  if (
    existing.externalId &&
    isBankHexId(existing.externalId) &&
    isBankHexId(incoming.externalId)
  ) {
    return false;
  }

  if (!descriptionsEquivalent(existing.description, incoming.description)) {
    return false;
  }
  if (Number(existing.amount.toString()) !== incoming.amount) return false;

  const incomingDay = Math.floor(incoming.bookedAt.getTime() / 86_400_000);
  const existingDay = Math.floor(existing.bookedAt.getTime() / 86_400_000);
  if (Math.abs(incomingDay - existingDay) > 2) return false;

  const incomingSynthetic = isFallbackSyntheticId(incoming.externalId);
  const existingSynthetic = existing.externalId
    ? isFallbackSyntheticId(existing.externalId)
    : false;

  return incomingSynthetic || existingSynthetic;
}

export function bookingShiftWindow(bookedAt: Date) {
  const start = new Date(bookedAt);
  start.setDate(start.getDate() - 2);
  start.setHours(0, 0, 0, 0);
  const end = new Date(bookedAt);
  end.setDate(end.getDate() + 2);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
