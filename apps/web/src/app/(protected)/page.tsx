import Link from "next/link";

export default function HomePage() {
  return (
    <div className="page">
      <header className="page-header">
        <p className="page-eyebrow">Open source · Ireland · EUR</p>
        <h1 className="page-title">Personal finance, clearly.</h1>
        <p className="page-subtitle">
          Connect your Irish bank accounts, sync transactions automatically, and
          see spending stats in one place. Built with Enable Banking open
          banking.
        </p>
      </header>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "2.5rem",
        }}
      >
        <Link href="/dashboard" className="btn btn-primary">
          Open dashboard
        </Link>
        <Link href="/sync" className="btn btn-secondary">
          Connect a bank
        </Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Step 1</span>
          <span className="stat-value balance">Connect</span>
          <span className="stat-hint">Pick your bank and authorise read-only access</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Step 2</span>
          <span className="stat-value balance">Sync</span>
          <span className="stat-hint">Pull balances and transactions into Póca</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Step 3</span>
          <span className="stat-value balance">Track</span>
          <span className="stat-hint">Review spending stats and transaction history</span>
        </div>
      </div>
    </div>
  );
}
