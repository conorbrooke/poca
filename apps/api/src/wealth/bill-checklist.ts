import { CategoryKind } from "@poca/db";
import {
  billPayeeOnChecklist,
  formatDateOnly,
  isBillPayeePaid,
  likelyPayDateThisMonth,
  medianAmount,
  monthBounds,
  roundCents,
  shiftMonth,
} from "@poca/shared";
import type { FxService } from "../fx/fx.service";
import type { PrismaService } from "../prisma/prisma.module";

function toNumber(value: { toString(): string }): number {
  return parseFloat(value.toString());
}

function payeeKey(payeeLabel: string | null | undefined, description: string): string {
  const trimmed = payeeLabel?.trim();
  return trimmed || description.slice(0, 40) || "Unknown";
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export type BillPayeeStatusLabel =
  | "paid"
  | "not_paid"
  | "not_seen"
  | "needs_confirm";

export type BillPayeeRow = {
  id: string | null;
  categoryId: string;
  categoryName: string;
  color: string;
  icon: string | null;
  cadence: "WEEKLY" | "MONTHLY" | "YEARLY";
  isEssential: boolean;
  payeeLabel: string;
  status: BillPayeeStatusLabel;
  thisMonthSpend: number;
  thisMonthCount: number;
  expected: number;
  lastPayDate: string | null;
  lastMonthTotal: number;
  likelyPayDate: string | null;
};

export type BillCategoryGroup = {
  categoryId: string;
  name: string;
  color: string;
  icon: string | null;
  cadence: "WEEKLY" | "MONTHLY" | "YEARLY";
  isEssential: boolean;
  spentThisMonth: number;
  expected: number;
  paidCount: number;
  dueCount: number;
  payees: BillPayeeRow[];
};

export type BillChecklist = {
  year: number;
  month: number;
  calendarNote: string | null;
  categories: BillCategoryGroup[];
  needsConfirm: BillPayeeRow[];
  notSeenLastMonth: BillPayeeRow[];
  likelyPayDays: Array<{
    payeeLabel: string;
    categoryName: string;
    date: string;
    expected: number;
    isEssential: boolean;
  }>;
  paidSpend: number;
  expectedDue: number;
  essentialExpected: number;
};

type TxHit = {
  categoryId: string;
  payeeLabel: string;
  amount: number;
  bookedAt: Date;
};

type MonthBucket = { total: number; count: number; lastDate: Date };

export async function buildBillChecklist(
  prisma: PrismaService,
  fx: FxService,
  userId: string,
  year: number,
  month: number,
  calendarNote: string | null,
): Promise<BillChecklist> {
  const focus = monthBounds(year, month);
  const prior = shiftMonth(year, month, -1);
  const priorBounds = monthBounds(prior.year, prior.month);
  const lookback = shiftMonth(year, month, -36);
  const lookbackStart = monthBounds(lookback.year, lookback.month).periodStart;

  const [categories, confirmed, rates] = await Promise.all([
    prisma.category.findMany({
      where: {
        userId,
        isBill: true,
        kind: CategoryKind.EXPENSE,
        deletedAt: null,
      },
      orderBy: [{ isEssential: "desc" }, { name: "asc" }],
    }),
    prisma.confirmedBillPayee.findMany({
      where: { userId },
    }),
    fx.getRates(),
  ]);

  const categoryIds = categories.map((category) => category.id);
  const hits: TxHit[] = [];

  if (categoryIds.length > 0) {
    const [unsplit, splits] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          isSplit: false,
          amount: { lt: 0 },
          bookedAt: { gte: lookbackStart, lte: focus.periodEnd },
          account: { userId },
          categoryId: { in: categoryIds },
        },
        select: {
          categoryId: true,
          payeeLabel: true,
          description: true,
          amount: true,
          currency: true,
          bookedAt: true,
        },
      }),
      prisma.transactionSplit.findMany({
        where: {
          amount: { lt: 0 },
          categoryId: { in: categoryIds },
          transaction: {
            isSplit: true,
            bookedAt: { gte: lookbackStart, lte: focus.periodEnd },
            account: { userId },
          },
        },
        select: {
          categoryId: true,
          payeeLabel: true,
          description: true,
          amount: true,
          transaction: { select: { bookedAt: true, currency: true } },
        },
      }),
    ]);

    for (const row of unsplit) {
      if (!row.categoryId) continue;
      hits.push({
        categoryId: row.categoryId,
        payeeLabel: payeeKey(row.payeeLabel, row.description),
        amount: Math.abs(fx.toEur(toNumber(row.amount), row.currency, rates)),
        bookedAt: row.bookedAt,
      });
    }
    for (const row of splits) {
      hits.push({
        categoryId: row.categoryId,
        payeeLabel: payeeKey(row.payeeLabel, row.description ?? ""),
        amount: Math.abs(
          fx.toEur(toNumber(row.amount), row.transaction.currency, rates),
        ),
        bookedAt: row.transaction.bookedAt,
      });
    }
  }

  const confirmedByKey = new Map(
    confirmed.map((row) => [`${row.categoryId}::${row.payeeLabel}`, row]),
  );
  const byPayee = new Map<
    string,
    { categoryId: string; payeeLabel: string; months: Map<string, MonthBucket> }
  >();

  for (const hit of hits) {
    const key = `${hit.categoryId}::${hit.payeeLabel}`;
    const current = byPayee.get(key) ?? {
      categoryId: hit.categoryId,
      payeeLabel: hit.payeeLabel,
      months: new Map(),
    };
    const mk = monthKey(hit.bookedAt);
    const bucket = current.months.get(mk) ?? {
      total: 0,
      count: 0,
      lastDate: hit.bookedAt,
    };
    bucket.total += hit.amount;
    bucket.count += 1;
    if (hit.bookedAt.getTime() > bucket.lastDate.getTime()) {
      bucket.lastDate = hit.bookedAt;
    }
    current.months.set(mk, bucket);
    byPayee.set(key, current);
  }

  const focusKey = monthKey(focus.periodStart);
  const priorKey = monthKey(priorBounds.periodStart);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const rows: BillPayeeRow[] = [];
  const seenKeys = new Set<string>();

  for (const [key, grouped] of byPayee) {
    seenKeys.add(key);
    const category = categoryById.get(grouped.categoryId);
    if (!category) continue;
    const confirmedRow = confirmedByKey.get(key);
    if (confirmedRow?.status === "IGNORED") continue;
    const thisMonthSpend = roundCents(grouped.months.get(focusKey)?.total ?? 0);
    if (!confirmedRow && thisMonthSpend <= 0) continue;
    rows.push(
      toPayeeRow({
        year,
        month,
        category,
        grouped,
        confirmed: confirmedRow ?? null,
        focusKey,
        priorKey,
      }),
    );
  }

  for (const row of confirmed) {
    const key = `${row.categoryId}::${row.payeeLabel}`;
    if (seenKeys.has(key) || row.status === "IGNORED") continue;
    const category = categoryById.get(row.categoryId);
    if (!category) continue;
    rows.push(
      toPayeeRow({
        year,
        month,
        category,
        grouped: {
          categoryId: row.categoryId,
          payeeLabel: row.payeeLabel,
          months: new Map(),
        },
        confirmed: row,
        focusKey,
        priorKey,
      }),
    );
  }

  const needsConfirm = rows.filter((row) => row.status === "needs_confirm");
  const notSeenLastMonth = rows.filter((row) => row.status === "not_seen");
  const checklist = rows.filter(
    (row) => row.status === "paid" || row.status === "not_paid",
  );

  const groups: BillCategoryGroup[] = categories.map((category) => {
    const payees = checklist
      .filter((row) => row.categoryId === category.id)
      .sort((left, right) => left.payeeLabel.localeCompare(right.payeeLabel));
    return {
      categoryId: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      cadence: category.billCadence,
      isEssential: category.isEssential,
      spentThisMonth: roundCents(
        payees.reduce((sum, row) => sum + row.thisMonthSpend, 0),
      ),
      expected: roundCents(payees.reduce((sum, row) => sum + row.expected, 0)),
      paidCount: payees.filter((row) => row.status === "paid").length,
      dueCount: payees.filter((row) => row.status === "not_paid").length,
      payees,
    };
  });

  const paidSpend = roundCents(
    checklist
      .filter((row) => row.status === "paid")
      .reduce((sum, row) => sum + row.thisMonthSpend, 0),
  );

  return {
    year,
    month,
    calendarNote,
    categories: groups,
    needsConfirm,
    notSeenLastMonth,
    likelyPayDays: checklist
      .filter((row) => row.likelyPayDate)
      .map((row) => ({
        payeeLabel: row.payeeLabel,
        categoryName: row.categoryName,
        date: row.likelyPayDate!,
        expected: row.expected,
        isEssential: row.isEssential,
      }))
      .sort((left, right) => left.date.localeCompare(right.date)),
    paidSpend,
    expectedDue: roundCents(
      checklist
        .filter((row) => row.status === "not_paid")
        .reduce((sum, row) => sum + row.expected, 0),
    ),
    essentialExpected: roundCents(
      checklist
        .filter((row) => row.isEssential)
        .reduce((sum, row) => sum + row.expected, 0),
    ),
  };
}

function toPayeeRow(input: {
  year: number;
  month: number;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    billCadence: "WEEKLY" | "MONTHLY" | "YEARLY";
    isEssential: boolean;
  };
  grouped: {
    categoryId: string;
    payeeLabel: string;
    months: Map<string, MonthBucket>;
  };
  confirmed: { id: string; status: "CONFIRMED" | "IGNORED" } | null;
  focusKey: string;
  priorKey: string;
}): BillPayeeRow {
  const thisMonth = input.grouped.months.get(input.focusKey);
  const lastMonth = input.grouped.months.get(input.priorKey);
  const history = [...input.grouped.months.entries()]
    .filter(([key]) => key < input.focusKey)
    .sort((left, right) => right[0].localeCompare(left[0]));
  const expected = medianAmount(
    history.slice(0, 3).map(([, bucket]) => roundCents(bucket.total)),
  );
  const lastOccurrence = history[0]?.[1] ?? null;
  const thisMonthSpend = roundCents(thisMonth?.total ?? 0);
  const onChecklist = billPayeeOnChecklist({
    cadence: input.category.billCadence,
    lastMonthTotal: lastMonth?.total ?? 0,
    lastOccurrenceMonth: lastOccurrence
      ? lastOccurrence.lastDate.getMonth() + 1
      : null,
    focusMonth: input.month,
    thisMonthSpend,
  });

  let status: BillPayeeStatusLabel = "needs_confirm";
  if (input.confirmed?.status === "CONFIRMED") {
    status = onChecklist
      ? isBillPayeePaid(thisMonthSpend, expected)
        ? "paid"
        : "not_paid"
      : "not_seen";
  }

  return {
    id: input.confirmed?.id ?? null,
    categoryId: input.category.id,
    categoryName: input.category.name,
    color: input.category.color,
    icon: input.category.icon,
    cadence: input.category.billCadence,
    isEssential: input.category.isEssential,
    payeeLabel: input.grouped.payeeLabel,
    status,
    thisMonthSpend,
    thisMonthCount: thisMonth?.count ?? 0,
    expected,
    lastPayDate: thisMonth
      ? formatDateOnly(thisMonth.lastDate)
      : lastOccurrence
        ? formatDateOnly(lastOccurrence.lastDate)
        : null,
    lastMonthTotal: roundCents(lastMonth?.total ?? 0),
    likelyPayDate:
      lastMonth && onChecklist
        ? likelyPayDateThisMonth(
            lastMonth.lastDate,
            input.year,
            input.month,
          )
        : null,
  };
}
