export function buildFallbackExternalId(
  amount: number,
  description: string,
  stableDate: string,
): string {
  return `${amount}-${description.trim()}-${stableDate}`;
}

export function isLegacySyntheticExternalId(externalId: string) {
  return /^\d{4}-\d{2}-\d{2}-/.test(externalId);
}
