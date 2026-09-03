"use client";

import { PeriodPicker } from "./period-picker";
import { useSpendingPeriod } from "../lib/spending-period";

export function WealthPeriodBar() {
  const { period, setPeriod } = useSpendingPeriod();
  return (
    <div className="wealth-period-bar">
      <PeriodPicker period={period} onChange={setPeriod} />
    </div>
  );
}
