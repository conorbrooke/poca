import { Suspense } from "react";
import { WealthNav } from "../../../components/wealth-nav";
import { WealthPeriodBar } from "../../../components/wealth-period-bar";

export default function WealthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="page">
      <header className="page-header">
        <p className="page-eyebrow">Keep more · Grow more</p>
        <h1 className="page-title">Wealth</h1>
        <p className="page-subtitle">
          Portfolio snapshot, bills that follow your spending categories,
          pension inflows, and a spending check — for one Irish household.
        </p>
      </header>
      <Suspense fallback={null}>
        <WealthNav />
        <WealthPeriodBar />
      </Suspense>
      {children}
    </div>
  );
}
