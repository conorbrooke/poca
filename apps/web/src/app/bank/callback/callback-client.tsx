"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export function BankCallbackClient() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing bank connection…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state || !API_URL) {
      setError("Missing authorisation code, state, or API URL.");
      return;
    }

    fetch(`${API_URL}/bank/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
