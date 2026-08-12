import { SyncClient } from "./sync-client";

export default function SyncPage() {
  return (
    <div className="page">
      <header className="page-header">
        <p className="page-eyebrow">Bank connections</p>
        <h1 className="page-title">Connect & sync</h1>
        <p className="page-subtitle">
          Link your Irish bank accounts and pull in the latest transactions with
          one click.
        </p>
      </header>
      <SyncClient />
    </div>
  );
}
