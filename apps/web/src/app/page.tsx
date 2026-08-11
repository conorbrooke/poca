import { IRISH_BANK_NAMES } from "@poca/shared";
import { apiFetchHeaders, apiUrl } from "../lib/api";

async function getHealth() {
  try {
    const res = await fetch(apiUrl("/health"), {
      cache: "no-store",
      headers: apiFetchHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getInstitutions() {
  try {
    const res = await fetch(apiUrl("/bank/institutions?country=IE"), {
      cache: "no-store",
      headers: apiFetchHeaders(),
    });
    if (!res.ok) return [];
    return res.json() as Promise<
      Array<{ id: string; name: string; logo?: string }>
    >;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [health, institutions] = await Promise.all([
    getHealth(),
    getInstitutions(),
  ]);

  const featuredNames = new Set<string>(IRISH_BANK_NAMES);
  const featured = institutions.filter((inst) =>
    [...featuredNames].some((name) =>
      inst.name.toLowerCase().includes(name.toLowerCase()),
    ),
  );

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <header style={{ marginBottom: "2.5rem" }}>
        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.875rem",
            marginBottom: "0.5rem",
          }}
        >
          Open source · Ireland · EUR
        </p>
        <h1
          style={{
            fontSize: "2.25rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          Póca
        </h1>
        <p style={{ color: "var(--muted)", marginTop: "0.75rem" }}>
          Personal finance tracking with Enable Banking connections for AIB, BOI,
          Revolut, and more.
        </p>
      </header>

      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "1.25rem 1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <h2
          style={{
            fontSize: "0.875rem",
            color: "var(--muted)",
            marginBottom: "0.5rem",
          }}
        >
          API status
        </h2>
        {health ? (
          <p style={{ color: "var(--accent)" }}>
            Connected — {health.service}
          </p>
        ) : (
          <p style={{ color: "#f87171" }}>
            API unreachable. Start the stack with{" "}
            <code style={{ fontSize: "0.85em" }}>pnpm dev</code>.
          </p>
        )}
      </section>

      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "1.25rem 1.5rem",
        }}
      >
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Irish banks</h2>
        {featured.length > 0 ? (
          <ul style={{ listStyle: "none", display: "grid", gap: "0.75rem" }}>
            {featured.map((inst) => (
              <li
                key={inst.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem",
                  background: "var(--bg)",
                  borderRadius: 8,
                }}
              >
                {inst.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={inst.logo} alt="" width={32} height={32} />
                )}
                <span>{inst.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            Configure Enable Banking credentials in <code>.env</code> to load
            institutions.
          </p>
        )}
      </section>
    </main>
  );
}
