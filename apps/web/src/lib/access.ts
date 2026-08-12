/** Temporary access gate until real auth is implemented */
export const ACCESS_COOKIE_NAME = "poca_access";

export function getAccessCode(): string | undefined {
  return process.env.ACCESS_CODE?.trim() || undefined;
}

export async function deriveAccessCookieToken(
  accessCode: string,
): Promise<string> {
  const data = new TextEncoder().encode(`poca-access-v1:${accessCode}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function isAccessGranted(
  token: string | undefined,
): Promise<boolean> {
  const accessCode = getAccessCode();
  if (!accessCode || !token) return false;
  const expected = await deriveAccessCookieToken(accessCode);
  return token === expected;
}
