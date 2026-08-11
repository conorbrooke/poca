"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetchHeaders, apiUrl } from "../../../lib/api";

export function BankCallbackClient() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing bank connection…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setError("Missing authorisation code or state from your bank.");
      return;
    }

    fetch(apiUrl("/bank/callback"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...apiFetchHeaders(),
      },
      body: JSON.stringify({ code, state }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text();
          throw new Error(body || `Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        setMessage(
          `Connected successfully — ${data.accountCount} account(s) linked.`,
        );
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  }, [searchParams]);

  return (
    <main style={{ maxWidth: 560, margin: "4rem auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
        Bank connection
      </h1>
      {error ? (
        <p style={{ color: "#f87171" }}>{error}</p>
      ) : (
        <p style={{ color: "var(--accent, #3dd68c)" }}>{message}</p>
      )}
    </main>
  );
}
