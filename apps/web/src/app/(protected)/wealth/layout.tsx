import { Suspense } from "react";
import { WealthNav } from "../../../components/wealth-nav";

export default function WealthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="page">
      <header className="page-header">
        <p className="page-eyebrow">Keep more · Grow more</p>
        <h1 className="page-title">Wealth</h1>
        <p className="page-subtitle">
          Budgets, spending leaks, savings, net worth, pension, and holdings —
          built for a single Irish household, not a tax return.
        </p>
      </header>
      <Suspense fallback={null}>
        <WealthNav />
      </Suspense>
      {children}
    </div>
  );
}
