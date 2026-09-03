"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "../../components/brand-logo";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const configError =
    searchParams.get("error") === "missing_access_code"
      ? "Access code is not configured on the server."
      : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Invalid access code");
      }

      const from = searchParams.get("from") ?? "/";
      router.replace(from);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-brand">
          <BrandLogo size={56} />
          <div>
            <p className="page-eyebrow">Póca · Private preview</p>
            <h1 className="login-title">Enter access code</h1>
          </div>
        </div>
        <p className="login-subtitle">
          This deployment is restricted. Enter the access code to continue.
        </p>

        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="login-label" htmlFor="access-code">
            Access code
          </label>
          <input
            id="access-code"
            className="login-input"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="Enter code"
            value={code}
            disabled={submitting}
            onChange={(event) => setCode(event.target.value)}
          />
          {configError ? <p className="alert alert-error">{configError}</p> : null}
          {error ? <p className="alert alert-error">{error}</p> : null}
          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={submitting || code.length === 0}
          >
            {submitting ? (
              <>
                <span className="loading-spinner" />
                Checking…
              </>
            ) : (
              "Continue"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
