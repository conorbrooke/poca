export type TransferCandidate = {
  id: string;
  accountId: string;
  amount: number;
  bookedAt: Date;
  categoryKind?: "EXPENSE" | "INCOME" | "TRANSFER" | null;
};

export type TransferMatch = {
  outId: string;
  inId: string;
  confidence: "high" | "medium";
};

const DAY_MS = 24 * 60 * 60 * 1000;

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(Math.abs(a) - Math.abs(b)) < 0.01;
}

function daysApart(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

export function matchTransferPairs(
  outflows: TransferCandidate[],
  inflows: TransferCandidate[],
  options: {
    maxDaysApart?: number;
    linkedOutIds?: Set<string>;
    linkedInIds?: Set<string>;
  } = {},
): TransferMatch[] {
  const maxDays = options.maxDaysApart ?? 3;
  const linkedOut = options.linkedOutIds ?? new Set<string>();
  const linkedIn = options.linkedInIds ?? new Set<string>();
  const usedIn = new Set<string>();
  const matches: TransferMatch[] = [];

  const sortedOutflows = [...outflows]
    .filter((row) => !linkedOut.has(row.id))
    .sort((a, b) => b.bookedAt.getTime() - a.bookedAt.getTime());

  for (const out of sortedOutflows) {
    let best: { inflow: TransferCandidate; confidence: "high" | "medium" } | null =
      null;

    for (const inf of inflows) {
      if (inf.accountId === out.accountId) continue;
      if (linkedIn.has(inf.id) || usedIn.has(inf.id)) continue;
      if (!amountsMatch(out.amount, inf.amount)) continue;

      const apart = daysApart(out.bookedAt, inf.bookedAt);
      if (apart > maxDays) continue;

      const confidence: "high" | "medium" =
        apart <= 1 &&
        (inf.categoryKind === "TRANSFER" || out.categoryKind === "TRANSFER")
          ? "high"
          : "medium";

      if (
        !best ||
        apart < daysApart(out.bookedAt, best.inflow.bookedAt) ||
        (apart === daysApart(out.bookedAt, best.inflow.bookedAt) &&
          confidence === "high" &&
          best.confidence === "medium")
      ) {
        best = { inflow: inf, confidence };
      }
    }

    if (best) {
      usedIn.add(best.inflow.id);
      matches.push({
        outId: out.id,
        inId: best.inflow.id,
        confidence: best.confidence,
      });
    }
  }

  return matches;
}
