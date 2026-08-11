/** Headers for fetches to ngrok free-tier URLs (avoids browser warning interstitial). */
export function apiFetchHeaders(): HeadersInit {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const headers: HeadersInit = {};
  if (apiUrl.includes("ngrok")) {
    headers["ngrok-skip-browser-warning"] = "true";
  }
  return headers;
}

export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }
  return `${base.replace(/\/$/, "")}${path}`;
}
