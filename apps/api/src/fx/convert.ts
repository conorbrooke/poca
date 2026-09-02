export const HOME_CURRENCY = "EUR";

export function roundConverted(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeRateMap(
  raw: Record<string, unknown>,
): Record<string, number> {
  const rates: Record<string, number> = { [HOME_CURRENCY]: 1 };

  for (const [code, value] of Object.entries(raw)) {
    const currency = code.toUpperCase();
    const units = typeof value === "number" ? value : Number(value);
    if (!currency || !Number.isFinite(units) || units <= 0) continue;
    rates[currency] = units;
  }

  return rates;
}

/**
 * `unitsPerEur[TRY]` means how many TRY equal 1 EUR.
 * TRY 110 at 55.92 TRY/EUR becomes 110 / 55.92 EUR.
 */
export function convertToEur(
  amount: number,
  currency: string,
  unitsPerEur: Record<string, number>,
): number {
  const code = (currency || HOME_CURRENCY).toUpperCase();
  if (code === HOME_CURRENCY) return roundConverted(amount);

  const units = unitsPerEur[code];
  if (!units || !Number.isFinite(units) || units <= 0) {
    return roundConverted(amount);
  }

  return roundConverted(amount / units);
}

export function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}
