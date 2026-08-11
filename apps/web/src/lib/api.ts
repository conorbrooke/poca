/** Headers for fetches to ngrok free-tier URLs (avoids browser warning interstitial). */
export function apiFetchHeaders(): HeadersInit {
  const apiUrl = getApiBase();
  const headers: HeadersInit = {};
  if (apiUrl.includes("ngrok")) {
    headers["ngrok-skip-browser-warning"] = "true";
  }
  return headers;
}

function getApiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }
  return base.replace(/\/$/, "");
}

/** Browser-safe API path. Use /api/backend proxy on Vercel → ngrok to avoid CORS. */
export function apiUrl(path: string): string {
  const base = getApiBase();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (base === "/api/backend" || base.endsWith("/api/backend")) {
    return `/api/backend${normalizedPath}`;
  }

  return `${base}${normalizedPath}`;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  const extra = apiFetchHeaders();
  for (const [key, value] of Object.entries(extra)) {
    if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  const res = await fetch(apiUrl(path), {
    ...init,
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}
