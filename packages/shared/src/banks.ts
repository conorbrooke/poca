/** Revolut Open Banking: full history only briefly after consent (PSD2). */
export const REVOLUT_EXTENDED_HISTORY_MINUTES = 5;

export function isRevolutInstitution(
  institutionId?: string | null,
  institutionName?: string | null,
): boolean {
  const id = institutionId?.toLowerCase() ?? "";
  const name = institutionName?.toLowerCase() ?? "";
  return id.includes("revolut") || name === "revolut" || name.includes("revolut");
}

export const REVOLUT_HISTORY_WARNING =
  "Revolut only shares more than 90 days of history for about 5 minutes after you approve the link. " +
  "Choose “Last year” and sync now if you want older transactions — later syncs are capped at 90 days unless you reconnect.";
