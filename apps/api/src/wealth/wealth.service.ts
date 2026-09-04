import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import {
  CategoryKind,
  type PensionKind,
  type WealthClass,
  type WealthSide,
  WealthValuationSource,
} from "@poca/db";
import type {
  CopyBudgetInput,
  SpendingPeriodInput,
  UpsertBillInput,
  UpsertBudgetInput,
  UpsertGoalInput,
  UpsertHoldingInput,
  UpsertWealthItemInput,
} from "@poca/shared";
import {
  afterDirt,
  amortisePoints,
  amortiseRemaining,
  budgetMonthFromPeriod,
  chartWindowFromFocus,
  depreciatedValue,
  emergencyFundTarget,
  formatDateOnly,
  holdingGain,
  holdingMarketValue,
  monthBounds,
  monthSurplus,
  monthlyPensionInflow,
  previousPeriodWindow,
  remainingBudget,
  resolveSpendingPeriod,
  roundCents,
  savingsRate,
  shiftMonth,
  spendingPeriodHrefQuery,
  sortAvalanche,
  sortSnowball,
} from "@poca/shared";
import { PrismaService } from "../prisma/prisma.module";
import { CategoriesService } from "../spending/categories.service";
import { FxService } from "../fx/fx.service";
import { buildBillChecklist } from "./bill-checklist";

function toNumber(value: { toString(): string }): number {
  return parseFloat(value.toString());
}

function prismaDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function eur(value: number): string {
  return `€${value.toFixed(2)}`;
}

function monthName(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IE", {
    month: "long",
  });
}

function currentMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

@Injectable()
export class WealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly fx: FxService,
  ) {}

  private demoUserId() {
    return this.categories.ensureDemoUserId();
  }

  resolveMonth(year?: number, month?: number) {
    const now = currentMonth();
    return { year: year ?? now.year, month: month ?? now.month };
  }

  private resolvePeriod(query: SpendingPeriodInput = {}) {
    return resolveSpendingPeriod(query);
  }

  async getOverview(query: SpendingPeriodInput = {}) {
    const userId = await this.demoUserId();
    const range = this.resolvePeriod(query);
    const budgetMonth = budgetMonthFromPeriod(range);
    const [budget, cashflow, netWorth, bills, goals, habits] = await Promise.all([
      this.getBudget(query),
      this.getCashflow(userId, range.periodStart, range.periodEnd),
      this.getNetWorth(userId),
      this.listBills(query),
      this.listGoals(),
      this.getHabits(query),
    ]);

    await this.snapshotNetWorth();
    const snapshots = await this.prisma.netWorthSnapshot.findMany({
      where: { userId },
      orderBy: { asOf: "desc" },
      take: 2,
    });
    const previousSnapshot = snapshots[1] ?? snapshots[0] ?? null;
    const netWorthDelta = previousSnapshot
      ? Math.round((netWorth.netWorth - toNumber(previousSnapshot.netWorth)) * 100) / 100
      : 0;

    const essentialMonthly = bills.essentialExpected;
    const emergencyTarget = emergencyFundTarget(essentialMonthly, 3);
    const emergencyGoal = goals.find((goal) => goal.kind === "EMERGENCY");
    const emergencySaved = emergencyGoal?.currentAmount ?? 0;
    const billSpend = bills.paidSpend;
    const surplus = Math.round((cashflow.income - cashflow.spending) * 100) / 100;
    const pensionMonthlyIn = netWorth.items
      .filter((item) => item.class === "PENSION")
      .reduce((sum, item) => sum + (item.monthlyInflow ?? 0), 0);

    return {
      year: budgetMonth.year,
      month: budgetMonth.month,
      periodLabel: range.label,
      periodKind: range.kind,
      rolledFrom: budget.rolledFrom,
      income: cashflow.income,
      spending: cashflow.spending,
      surplus,
      leftover: budget.leftover,
      savingsRate: savingsRate(cashflow.income, cashflow.spending),
      interestGross: cashflow.interestGross,
      interestAfterDirt: afterDirt(cashflow.interestGross),
      budgeted: budget.totalBudgeted,
      spentOfBudget: budget.totalSpent,
      remaining: remainingBudget(
        budget.overallCap ?? budget.totalBudgeted,
        budget.totalSpent,
      ),
      overallCap: budget.overallCap,
      overBudgetCount: budget.lines.filter((line) => line.spent > line.amount && line.amount > 0)
        .length,
      netWorth: netWorth.netWorth,
      netWorthDelta,
      assets: netWorth.assets,
      liabilities: netWorth.liabilities,
      allocation: netWorth.allocation,
      pensionMonthlyIn: Math.round(pensionMonthlyIn * 100) / 100,
      billSpend: Math.round(billSpend * 100) / 100,
      essentialMonthly,
      emergencyTarget,
      emergencySaved,
      habitAlerts: habits.actions.filter((action) => action.severity === "high")
        .length,
    };
  }

  async getBudget(query: SpendingPeriodInput = {}) {
    const userId = await this.demoUserId();
    const range = this.resolvePeriod(query);
    const { year, month } = budgetMonthFromPeriod(range);
    const { periodStart, periodEnd } = range;
    const [thisMonth, prior, spentRows, categories] = await Promise.all([
      this.prisma.monthlyBudget.findUnique({
        where: {
          userId_year_month: { userId, year, month },
        },
        include: { lines: true },
      }),
      this.prisma.monthlyBudget.findFirst({
        where: {
          userId,
          OR: [{ year: { lt: year } }, { year, month: { lt: month } }],
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        include: { lines: true },
      }),
      this.categoryTotals(userId, periodStart, periodEnd, CategoryKind.EXPENSE),
      this.prisma.category.findMany({
        where: { userId, kind: CategoryKind.EXPENSE, deletedAt: null },
        orderBy: { name: "asc" },
      }),
    ]);

    const budget = thisMonth ?? prior;
    const rolledFrom =
      !thisMonth && prior ? { year: prior.year, month: prior.month } : null;

    const spentByCategory = new Map(spentRows.map((row) => [row.categoryId, row]));
    const lineByCategory = new Map(
      (budget?.lines ?? []).map((line) => [line.categoryId, toNumber(line.amount)]),
    );

    const lines = categories.map((category) => {
      const spent = spentByCategory.get(category.id);
      const amount = lineByCategory.get(category.id) ?? 0;
      const spentAmount = spent?.total ?? 0;
      return {
        categoryId: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        amount,
        spent: spentAmount,
        remaining: remainingBudget(amount, spentAmount),
        transactionCount: spent?.count ?? 0,
        isBill: category.isBill,
        isEssential: category.isEssential,
        isVariable: category.isVariable,
      };
    });

    const totalBudgeted = lines.reduce((sum, line) => sum + line.amount, 0);
    const totalSpent = lines.reduce((sum, line) => sum + line.spent, 0);
    const leftover = await this.buildLeftover(userId, year, month);

    return {
      id: thisMonth?.id ?? null,
      year,
      month,
      periodLabel: range.label,
      rolledFrom,
      overallCap: budget?.overallCap ? toNumber(budget.overallCap) : null,
      totalBudgeted,
      totalSpent,
      remaining: remainingBudget(totalBudgeted, totalSpent),
      leftover,
      lines,
    };
  }

  private async buildLeftover(userId: string, year: number, month: number) {
    const prior = shiftMonth(year, month, -1);
    const priorBounds = monthBounds(prior.year, prior.month);
    const focusBounds = monthBounds(year, month);
    const [
      priorFlow,
      focusFlow,
      priorBills,
      focusBills,
      priorVariable,
      focusVariable,
      priorLoans,
      focusLoans,
      variableCategories,
    ] = await Promise.all([
      this.getCashflow(userId, priorBounds.periodStart, priorBounds.periodEnd),
      this.getCashflow(userId, focusBounds.periodStart, focusBounds.periodEnd),
      buildBillChecklist(this.prisma, this.fx, userId, prior.year, prior.month, null),
      buildBillChecklist(this.prisma, this.fx, userId, year, month, null),
      this.kindTotals(userId, priorBounds.periodStart, priorBounds.periodEnd, "variable"),
      this.kindTotals(userId, focusBounds.periodStart, focusBounds.periodEnd, "variable"),
      this.loanTransferTotal(userId, priorBounds.periodStart, priorBounds.periodEnd),
      this.loanTransferTotal(userId, focusBounds.periodStart, focusBounds.periodEnd),
      this.prisma.category.findMany({
        where: {
          userId,
          isVariable: true,
          kind: CategoryKind.EXPENSE,
          deletedAt: null,
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const priorSurplus = monthSurplus(
      priorFlow.income,
      priorFlow.spending,
      priorLoans.total,
    );
    const afterBills = roundCents(priorFlow.income - priorBills.paidSpend);
    const moneyIn = roundCents(priorSurplus + focusFlow.income);
    const expectedBills = roundCents(
      focusBills.categories.reduce((sum, category) => sum + category.expected, 0),
    );
    const loanReserve = focusLoans.total > 0 ? focusLoans.total : priorLoans.total;
    const spendingLimit = roundCents(
      moneyIn - expectedBills - priorVariable.total - loanReserve,
    );
    const now = new Date();
    const monthClosed =
      now.getFullYear() > year ||
      (now.getFullYear() === year && now.getMonth() + 1 > month);

    return {
      priorMonthLabel: `${monthName(prior.year, prior.month)} ${prior.year}`,
      priorSurplus,
      priorSurplusLabel:
        priorSurplus >= 0 ? "Surplus from last month" : "Shortfall from last month",
      afterBillsInsight: afterBills,
      incomeThisMonth: focusFlow.income,
      incomeIncomplete: !monthClosed,
      expectedBills,
      billsByCategory: focusBills.categories
        .filter((category) => category.expected > 0 || category.spentThisMonth > 0)
        .map((category) => ({
          categoryId: category.categoryId,
          name: category.name,
          color: category.color,
          icon: category.icon,
          isEssential: category.isEssential,
          expected: category.expected,
          spent: category.spentThisMonth,
        })),
      variableLastMonth: priorVariable.total,
      variableThisMonth: focusVariable.total,
      variableCategories: variableCategories.map((category) => ({
        categoryId: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
      })),
      loanLastMonth: priorLoans.total,
      loanThisMonth: focusLoans.total,
      loanItems: priorLoans.items.length > 0 ? priorLoans.items : focusLoans.items,
      likelyPayDays: focusBills.likelyPayDays,
      spendingLimit,
      moneyIn,
    };
  }

  private async kindTotals(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    kind: "variable",
  ) {
    const rows = await this.categoryTotals(
      userId,
      periodStart,
      periodEnd,
      CategoryKind.EXPENSE,
    );
    const categories = await this.prisma.category.findMany({
      where: { userId, isVariable: true, deletedAt: null },
      select: { id: true },
    });
    const ids = new Set(categories.map((category) => category.id));
    const matched = rows.filter((row) => ids.has(row.categoryId));
    return {
      total: roundCents(matched.reduce((sum, row) => sum + row.total, 0)),
      rows: matched,
    };
  }

  private async loanTransferTotal(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const rates = await this.fx.getRates();
    const rows = await this.prisma.wealthItemLedger.findMany({
      where: {
        role: { in: ["REPAYMENT"] },
        wealthItem: { userId, side: "LIABILITY" },
        transaction: { bookedAt: { gte: periodStart, lte: periodEnd } },
      },
      include: {
        wealthItem: { select: { id: true, name: true } },
        transaction: { select: { amount: true, currency: true } },
      },
    });
    const byItem = new Map<string, { id: string; name: string; total: number }>();
    for (const row of rows) {
      const amount = Math.abs(
        this.fx.toEur(
          toNumber(row.transaction.amount),
          row.transaction.currency,
          rates,
        ),
      );
      const current = byItem.get(row.wealthItem.id) ?? {
        id: row.wealthItem.id,
        name: row.wealthItem.name,
        total: 0,
      };
      current.total += amount;
      byItem.set(row.wealthItem.id, current);
    }
    const items = [...byItem.values()].map((item) => ({
      ...item,
      total: roundCents(item.total),
    }));
    return {
      total: roundCents(items.reduce((sum, item) => sum + item.total, 0)),
      items,
    };
  }

  async upsertBudget(input: UpsertBudgetInput) {
    const userId = await this.demoUserId();
    const budget = await this.prisma.monthlyBudget.upsert({
      where: {
        userId_year_month: {
          userId,
          year: input.year,
          month: input.month,
        },
      },
      create: {
        userId,
        year: input.year,
        month: input.month,
        overallCap: input.overallCap ?? null,
      },
      update: {
        overallCap: input.overallCap ?? null,
      },
    });

    await this.prisma.budgetLine.deleteMany({ where: { budgetId: budget.id } });
    if (input.lines.length > 0) {
      await this.prisma.budgetLine.createMany({
        data: input.lines.map((line) => ({
          budgetId: budget.id,
          categoryId: line.categoryId,
          amount: line.amount,
        })),
      });
    }

    return this.getBudget({ year: input.year, month: input.month });
  }

  async copyBudget(input: CopyBudgetInput) {
    const userId = await this.demoUserId();
    const previous = shiftMonth(input.year, input.month, -1);
    if (input.fromActuals) {
      const { periodStart, periodEnd } = monthBounds(previous.year, previous.month);
      const spent = await this.categoryTotals(
        userId,
        periodStart,
        periodEnd,
        CategoryKind.EXPENSE,
      );
      return this.upsertBudget({
        year: input.year,
        month: input.month,
        lines: spent
          .filter((row) => row.total > 0)
          .map((row) => ({
            categoryId: row.categoryId,
            amount: row.total,
          })),
      });
    }

    const prior = await this.prisma.monthlyBudget.findUnique({
      where: {
        userId_year_month: {
          userId,
          year: previous.year,
          month: previous.month,
        },
      },
      include: { lines: true },
    });
    return this.upsertBudget({
      year: input.year,
      month: input.month,
      overallCap: prior?.overallCap ? toNumber(prior.overallCap) : null,
      lines: (prior?.lines ?? []).map((line) => ({
        categoryId: line.categoryId,
        amount: toNumber(line.amount),
      })),
    });
  }

  async getHabits(query: SpendingPeriodInput = {}) {
    const userId = await this.demoUserId();
    const range = this.resolvePeriod(query);
    const previous = previousPeriodWindow(range);
    const now = new Date();
    const isCurrentMonth =
      range.kind === "month" &&
      now.getFullYear() === range.year &&
      now.getMonth() + 1 === range.month;
    const monthQuery = spendingPeriodHrefQuery(range);

    const [
      budget,
      merchants,
      previousMerchants,
      time,
      leaks,
      cashflow,
      previousCashflow,
      previousExpenseRows,
    ] = await Promise.all([
      this.getBudget(query),
      this.merchantTotals(userId, range.periodStart, range.periodEnd),
      this.merchantTotals(userId, previous.periodStart, previous.periodEnd),
      this.timePatterns(userId, range.periodStart, range.periodEnd),
      this.leakTotals(userId, range.periodStart, range.periodEnd),
      this.getCashflow(userId, range.periodStart, range.periodEnd),
      this.getCashflow(userId, previous.periodStart, previous.periodEnd),
      this.categoryTotals(
        userId,
        previous.periodStart,
        previous.periodEnd,
        CategoryKind.EXPENSE,
      ),
    ]);

    const previousByPayee = new Map(
      previousMerchants.map((row) => [row.payee, row]),
    );
    const previousByCategory = new Map(
      previousExpenseRows.map((row) => [row.categoryId, row.total]),
    );

    const overBudget = budget.lines
      .filter((line) => line.amount > 0 && line.spent > line.amount)
      .map((line) => ({
        categoryId: line.categoryId,
        name: line.name,
        spent: line.spent,
        amount: line.amount,
        overBy: Math.round((line.spent - line.amount) * 100) / 100,
        href: `/spending/${line.categoryId}?${monthQuery}`,
      }));

    const unbudgeted = budget.lines
      .filter(
        (line) =>
          line.amount === 0 &&
          line.spent >= 150 &&
          !line.isBill &&
          !["atm", "other"].includes(line.name.toLowerCase()),
      )
      .sort((left, right) => right.spent - left.spent)
      .slice(0, 3);

    const merchantRows = merchants.slice(0, 12).map((row) => {
      const last = previousByPayee.get(row.payee);
      const previousTotal = last?.total ?? 0;
      const delta = Math.round((row.total - previousTotal) * 100) / 100;
      return {
        payee: row.payee,
        count: row.count,
        total: row.total,
        previousTotal,
        delta,
        isNew: previousTotal === 0 && row.count >= 2 && row.total >= 25,
        isFrequent: row.count >= 4,
        jumped: previousTotal > 0 && row.total >= previousTotal * 1.4 && delta >= 25,
      };
    });

    const totalSpend = time.weekday + time.weekend;
    const weekendShare =
      totalSpend > 0 ? Math.round((time.weekend / totalSpend) * 100) : 0;
    const lateShare =
      time.early + time.late > 0
        ? Math.round((time.late / (time.early + time.late)) * 100)
        : 0;
    const tooEarlyForLateMonth = isCurrentMonth && now.getDate() < 22;

    const leakRows = leaks.map((leak) => {
      const href =
        leak.id === "revolut"
          ? "/guide"
          : leak.categoryId
            ? `/spending/${leak.categoryId}?${monthQuery}`
            : `/spending?${monthQuery}`;
      if (leak.id === "revolut") {
        return {
          ...leak,
          href,
          why: "A BOI (or other bank) card payment to Revolut is a top-up, not spending. If it stays as an expense, the same money is counted twice when you spend it from Revolut.",
          doNext: "Open the guide, then recategorise these as Transfer.",
        };
      }
      if (leak.id === "atm") {
        return {
          ...leak,
          href,
          why: "Cash out is unplaced spending. Until you assign it (groceries, nights out, etc.), your budget cannot see where it went.",
          doNext: "Open ATM and recategorise or split the withdrawals you remember.",
        };
      }
      return {
        ...leak,
        href,
        why: "Other is a holding pen. Money parked here does not inform a grocery, dining, or fuel budget.",
        doNext: "Open Other and give each line a real category.",
      };
    });

    type Action = {
      id: string;
      severity: "high" | "medium" | "ok";
      title: string;
      why: string;
      doNext: string;
      href: string;
      amount: number;
    };
    const actions: Action[] = [];

    if (budget.overallCap && budget.totalSpent > budget.overallCap) {
      actions.push({
        id: "cap",
        severity: "high",
        title: "Overall monthly cap exceeded",
        why: `${eur(budget.totalSpent)} spent against a ${eur(budget.overallCap)} cap.`,
        doNext: "Open the budget and cut a flexible category, or raise the cap if it was too tight.",
        href: `/wealth/budget?${monthQuery}`,
        amount: budget.totalSpent - budget.overallCap,
      });
    }

    for (const leak of leakRows) {
      if (leak.total <= 0) continue;
      actions.push({
        id: `leak-${leak.id}`,
        severity: leak.total >= 50 ? "high" : "medium",
        title: leak.label,
        why: leak.why,
        doNext: leak.doNext,
        href: leak.href,
        amount: leak.total,
      });
    }

    for (const line of overBudget) {
      actions.push({
        id: `budget-${line.categoryId}`,
        severity: line.overBy >= 40 ? "high" : "medium",
        title: `${line.name} is over budget`,
        why: `${eur(line.spent)} spent of ${eur(line.amount)} — ${eur(line.overBy)} over.`,
        doNext: "See the merchants in this category, then either recategorise mistakes or trim next month’s budget.",
        href: line.href,
        amount: line.overBy,
      });
    }

    for (const line of unbudgeted) {
      actions.push({
        id: `unbudgeted-${line.categoryId}`,
        severity: "medium",
        title: `${line.name} has spend but no budget`,
        why: `${eur(line.spent)} went here with €0 budgeted, so overspend alerts never fire.`,
        doNext: "Set a monthly amount on the budget page.",
        href: `/wealth/budget?${monthQuery}`,
        amount: line.spent,
      });
    }

    const jumpedMerchant = merchantRows.find((row) => row.jumped);
    if (jumpedMerchant) {
      actions.push({
        id: `merchant-${jumpedMerchant.payee}`,
        severity: "medium",
        title: `${jumpedMerchant.payee} jumped vs last month`,
        why: `${eur(jumpedMerchant.total)} this month vs ${eur(jumpedMerchant.previousTotal)} last month.`,
        doNext: "Check whether this is a one-off, a bill spike, or a habit worth cutting.",
        href: `/spending?${monthQuery}`,
        amount: jumpedMerchant.delta,
      });
    }

    if (weekendShare >= 50 && time.weekend >= 80) {
      actions.push({
        id: "weekend",
        severity: "medium",
        title: "Weekends are taking a large share",
        why: `${weekendShare}% of expense spend landed Friday–Sunday (${eur(time.weekend)}). Three days of the week are ~43% of days.`,
        doNext: "Scan restaurants, takeaways, and pubs on the spending page for Friday–Sunday.",
        href: `/spending?${monthQuery}`,
        amount: time.weekend,
      });
    }

    if (!tooEarlyForLateMonth && lateShare >= 45 && time.late >= 80) {
      actions.push({
        id: "late-month",
        severity: "medium",
        title: "Spending piled up after the 21st",
        why: `${lateShare}% of spend was in the last third of the month (${eur(time.late)}).`,
        doNext: "If payday is monthly, this is the squeeze — lock a leftover target before the 22nd.",
        href: `/wealth/budget?${monthQuery}`,
        amount: time.late,
      });
    }

    actions.sort((left, right) => {
      const rank = { high: 0, medium: 1, ok: 2 };
      if (rank[left.severity] !== rank[right.severity]) {
        return rank[left.severity] - rank[right.severity];
      }
      return right.amount - left.amount;
    });

    if (actions.length === 0) {
      const delta = cashflow.spending - previousCashflow.spending;
      actions.push({
        id: "ok",
        severity: "ok",
        title: "No leaks worth acting on this month",
        why:
          delta > 10
            ? `Spending is ${eur(delta)} higher than the previous ${range.label.toLowerCase() === "all time" ? "window" : "period"}, but nothing is over budget or sitting in ATM/Other/Revolut.`
            : "Budgets, categorisation, and merchant totals look in line. Use this page again mid-month.",
        doNext: "Keep categorising new lines as they sync so next month’s check stays honest.",
        href: `/spending?${monthQuery}`,
        amount: 0,
      });
    }

    const surplusEaters = budget.lines
      .filter((line) => line.spent > 0)
      .sort((left, right) => right.spent - left.spent)
      .slice(0, 6)
      .map((line) => {
        const previousTotal = previousByCategory.get(line.categoryId) ?? 0;
        return {
          categoryId: line.categoryId,
          name: line.name,
          total: line.spent,
          previousTotal,
          delta: Math.round((line.spent - previousTotal) * 100) / 100,
          href: `/spending/${line.categoryId}?${monthQuery}`,
        };
      });

    const weekendInsight =
      totalSpend === 0
        ? "No expense spend in this month yet."
        : weekendShare >= 50
          ? "Friday–Sunday is heavier than a flat daily split. That is usually dining, drink, or shopping."
          : "Monday–Thursday is carrying most of the month — typical for commuting, groceries, and bills.";

    const lateInsight = tooEarlyForLateMonth
      ? "Too early in the month to judge a late-month squeeze."
      : lateShare >= 45
        ? "A large share landed after the 21st. Check whether that is bills, a trip, or drift."
        : "Spend is reasonably spread across the month.";

    return {
      year: budgetMonthFromPeriod(range).year,
      month: budgetMonthFromPeriod(range).month,
      periodLabel: range.label,
      income: cashflow.income,
      spending: cashflow.spending,
      surplus: Math.round((cashflow.income - cashflow.spending) * 100) / 100,
      previousSpending: previousCashflow.spending,
      spendingDelta:
        Math.round((cashflow.spending - previousCashflow.spending) * 100) / 100,
      actions,
      alerts: actions
        .filter((action) => action.severity === "high")
        .map((action) => ({
          type: action.id.startsWith("leak") ? "leak" : "over-budget",
          title: action.title,
          detail: action.why,
        })),
      overBudget,
      merchants: merchantRows,
      weekday: {
        weekday: time.weekday,
        weekend: time.weekend,
        weekendShare,
        insight: weekendInsight,
      },
      time: {
        early: time.early,
        late: time.late,
        lateShare,
        tooEarly: tooEarlyForLateMonth,
        insight: lateInsight,
      },
      leaks: leakRows,
      surplusEaters,
    };
  }

  async listBills(query: SpendingPeriodInput = {}) {
    const userId = await this.demoUserId();
    await this.categories.ensureDefaults(userId);
    const range = this.resolvePeriod(query);
    const { year, month } = budgetMonthFromPeriod(range);
    const calendarNote =
      range.kind === "month"
        ? null
        : `Paid / not paid is ${monthName(year, month)} ${year}, not ${range.label}.`;
    return buildBillChecklist(
      this.prisma,
      this.fx,
      userId,
      year,
      month,
      calendarNote,
    );
  }

  async upsertBillPayee(input: {
    categoryId: string;
    payeeLabel: string;
    status: "CONFIRMED" | "IGNORED";
  }) {
    const userId = await this.demoUserId();
    const category = await this.prisma.category.findFirst({
      where: {
        id: input.categoryId,
        userId,
        isBill: true,
        deletedAt: null,
      },
    });
    if (!category) throw new NotFoundException("Bill category not found");
    return this.prisma.confirmedBillPayee.upsert({
      where: {
        categoryId_payeeLabel: {
          categoryId: input.categoryId,
          payeeLabel: input.payeeLabel,
        },
      },
      create: {
        userId,
        categoryId: input.categoryId,
        payeeLabel: input.payeeLabel,
        status: input.status,
      },
      update: { status: input.status },
    });
  }

  async suggestBills() {
    const userId = await this.demoUserId();
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 90);
    const merchants = await this.merchantTotals(userId, start, now);
    return merchants
      .filter((row) => row.count >= 3)
      .slice(0, 12)
      .map((row) => ({
        name: row.payee,
        payeeMatch: row.payee,
        typicalAmount: Math.round((row.total / row.count) * 100) / 100,
        count: row.count,
      }));
  }

  async createBill(input: UpsertBillInput) {
    const userId = await this.demoUserId();
    if (input.categoryId) {
      await this.categories.updateCategory(userId, input.categoryId, {
        isBill: true,
        isEssential: input.isEssential,
        billCadence: input.cadence,
      });
      return this.prisma.category.findFirstOrThrow({
        where: { id: input.categoryId, userId },
      });
    }
    return this.categories.createCategory(userId, {
      name: input.name,
      kind: "EXPENSE",
      isBill: true,
      isEssential: input.isEssential,
      billCadence: input.cadence,
      icon: input.icon,
      color: input.color,
    });
  }

  async updateBill(id: string, input: UpsertBillInput) {
    const userId = await this.demoUserId();
    return this.categories.updateCategory(userId, id, {
      name: input.name,
      isBill: true,
      isEssential: input.isEssential,
      billCadence: input.cadence,
    });
  }

  async deleteBill(id: string) {
    const userId = await this.demoUserId();
    const category = await this.prisma.category.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (category) {
      await this.prisma.category.update({
        where: { id },
        data: { isBill: false, isEssential: false },
      });
      return { deleted: true };
    }
    await this.requireBill(userId, id);
    await this.prisma.recurringBill.delete({ where: { id } });
    return { deleted: true };
  }

  async listGoals() {
    const userId = await this.demoUserId();
    const bills = await this.listBills();
    const essentialMonthly = bills.essentialExpected;
    const suggestedEmergency = emergencyFundTarget(essentialMonthly, 3);
    const [goals, rates] = await Promise.all([
      this.prisma.savingsGoal.findMany({
        where: { userId },
        include: {
          account: { select: { id: true, name: true, currentBalance: true } },
          fundings: {
            include: {
              transaction: {
                include: {
                  account: { select: { id: true, name: true } },
                  category: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.fx.getRates(),
    ]);
    const accountIds = goals
      .map((goal) => goal.accountId)
      .filter((value): value is string => Boolean(value));
    const inbound =
      accountIds.length === 0
        ? []
        : await this.prisma.transaction.findMany({
            where: { accountId: { in: accountIds }, amount: { gt: 0 } },
            orderBy: { bookedAt: "desc" },
            include: {
              account: { select: { id: true, name: true } },
              category: { select: { id: true, name: true } },
            },
          });
    const inboundByAccount = new Map<string, typeof inbound>();
    for (const row of inbound) {
      const list = inboundByAccount.get(row.accountId) ?? [];
      if (list.length < 12) list.push(row);
      inboundByAccount.set(row.accountId, list);
    }

    return goals.map((goal) => {
      const assigned = goal.fundings
        .filter((funding) => funding.transaction.accountId !== goal.accountId)
        .map((funding) =>
          this.serializeGoalTx("assigned", funding.transaction, rates),
        );
      const accountTrail = (goal.accountId
        ? inboundByAccount.get(goal.accountId) ?? []
        : []
      ).map((tx) => this.serializeGoalTx("account", tx, rates));
      const accountAmount = goal.account
        ? Math.max(toNumber(goal.account.currentBalance), 0)
        : 0;
      const assignedAmount = assigned.reduce((sum, row) => sum + row.amount, 0);
      const currentAmount = Math.round((accountAmount + assignedAmount) * 100) / 100;
      const targetAmount = toNumber(goal.targetAmount);
      const trail = [...assigned, ...accountTrail].sort(
        (left, right) => Date.parse(right.bookedAt) - Date.parse(left.bookedAt),
      );
      return {
        id: goal.id,
        name: goal.name,
        kind: goal.kind,
        targetAmount,
        targetDate: goal.targetDate?.toISOString() ?? null,
        currentAmount,
        accountAmount,
        assignedAmount,
        accountId: goal.accountId,
        accountName: goal.account?.name ?? null,
        notes: goal.notes,
        trail,
        progress:
          targetAmount > 0
            ? Math.round((currentAmount / targetAmount) * 1000) / 10
            : 0,
        suggestedEmergency:
          goal.kind === "EMERGENCY" ? suggestedEmergency : null,
      };
    });
  }

  async createGoal(input: UpsertGoalInput) {
    const userId = await this.demoUserId();
    const accountId = await this.requireGoalAccount(userId, input.accountId);
    return this.prisma.savingsGoal.create({
      data: {
        userId,
        name: input.name,
        kind: input.kind,
        targetAmount: input.targetAmount,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        currentAmount: 0,
        accountId,
        notes: input.notes ?? null,
      },
    });
  }

  async assignGoalTransaction(id: string, transactionId: string) {
    const userId = await this.demoUserId();
    const goal = await this.requireGoal(userId, id);
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, account: { userId } },
      include: { account: { select: { id: true } } },
    });
    if (!transaction) throw new NotFoundException("Transaction not found");
    if (goal.accountId && transaction.accountId === goal.accountId) {
      throw new BadRequestException(
        "That transaction already sits in the linked account, so it is already counted.",
      );
    }
    const existing = await this.prisma.goalFunding.findUnique({
      where: { transactionId },
    });
    if (existing) {
      throw new BadRequestException("That transaction already funds a goal.");
    }
    await this.prisma.goalFunding.create({
      data: { goalId: goal.id, transactionId },
    });
    return this.listGoals().then((goals) => goals.find((item) => item.id === id));
  }

  async unassignGoalTransaction(id: string, transactionId: string) {
    const userId = await this.demoUserId();
    await this.requireGoal(userId, id);
    const funding = await this.prisma.goalFunding.findFirst({
      where: { goalId: id, transactionId },
    });
    if (!funding) throw new NotFoundException("Funding not found");
    await this.prisma.goalFunding.delete({ where: { id: funding.id } });
    return { deleted: true };
  }

  async listGoalCandidates(id: string) {
    const userId = await this.demoUserId();
    const goal = await this.requireGoal(userId, id);
    const assigned = await this.prisma.goalFunding.findMany({
      where: { goal: { userId } },
      select: { transactionId: true },
    });
    const assignedIds = assigned.map((row) => row.transactionId);
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const rates = await this.fx.getRates();
    const rows = await this.prisma.transaction.findMany({
      where: {
        account: { userId, isActive: true },
        bookedAt: { gte: since },
        id: assignedIds.length > 0 ? { notIn: assignedIds } : undefined,
        ...(goal.accountId ? { accountId: { not: goal.accountId } } : {}),
      },
      include: {
        account: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { bookedAt: "desc" },
      take: 40,
    });
    return rows
      .map((tx) => this.serializeGoalTx("assigned", tx, rates))
      .sort((left, right) => {
        const rank = (name: string | null) => {
          const label = (name ?? "").toLowerCase();
          if (label.includes("atm")) return 0;
          if (label.includes("transfer")) return 1;
          return 2;
        };
        const diff = rank(left.categoryName) - rank(right.categoryName);
        if (diff !== 0) return diff;
        return Date.parse(right.bookedAt) - Date.parse(left.bookedAt);
      });
  }

  async updateGoal(id: string, input: UpsertGoalInput) {
    const userId = await this.demoUserId();
    await this.requireGoal(userId, id);
    const accountId = await this.requireGoalAccount(userId, input.accountId);
    return this.prisma.savingsGoal.update({
      where: { id },
      data: {
        name: input.name,
        kind: input.kind,
        targetAmount: input.targetAmount,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        currentAmount: 0,
        accountId,
        notes: input.notes ?? null,
      },
    });
  }

  async deleteGoal(id: string) {
    const userId = await this.demoUserId();
    await this.requireGoal(userId, id);
    await this.prisma.savingsGoal.delete({ where: { id } });
    return { deleted: true };
  }

  async listAccounts() {
    const userId = await this.demoUserId();
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      orderBy: { name: "asc" },
    });
    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      currentBalance: toNumber(account.currentBalance),
      accountType: account.accountType,
      institutionName: account.institutionName,
    }));
  }

  async getNetWorth(userId?: string) {
    const id = userId ?? (await this.demoUserId());
    const [accounts, items, holdings, rates] = await Promise.all([
      this.prisma.account.findMany({ where: { userId: id, isActive: true } }),
      this.prisma.wealthItem.findMany({
        where: { userId: id },
        include: {
          ledgers: { include: { transaction: true } },
          valuations: { orderBy: { asOf: "asc" } },
        },
      }),
      this.prisma.holding.findMany({ where: { userId: id } }),
      this.fx.getRates(),
    ]);

    const linkedAccountIds = new Set(
      items.map((item) => item.accountId).filter((value): value is string => Boolean(value)),
    );
    const bankCash = accounts
      .filter((account) => !linkedAccountIds.has(account.id))
      .reduce((sum, account) => {
        const balance = toNumber(account.currentBalance);
        const isLoan = (account.accountType ?? "").toUpperCase() === "LOAN";
        return isLoan ? sum : sum + Math.max(balance, 0);
      }, 0);

    const savings = accounts
      .filter((account) => !linkedAccountIds.has(account.id))
      .reduce((sum, account) => {
        const balance = toNumber(account.currentBalance);
        const isLoan = (account.accountType ?? "").toUpperCase() === "LOAN";
        const isSavings = (account.accountType ?? "").toUpperCase() === "SVGS";
        return !isLoan && isSavings ? sum + Math.max(balance, 0) : sum;
      }, 0);
    const cash = Math.round((bankCash - savings) * 100) / 100;

    const holdingsValue = holdings.reduce((sum, holding) => {
      const price = holding.lastPrice
        ? toNumber(holding.lastPrice)
        : toNumber(holding.averageCost);
      return sum + holdingMarketValue(toNumber(holding.quantity), price);
    }, 0);

    const serialized = items.map((item) =>
      this.serializeWealthItem(item, accounts, rates),
    );
    const valueOf = (cls: WealthClass, side: "ASSET" | "LIABILITY") =>
      serialized
        .filter((item) => item.side === side && item.class === cls)
        .reduce((sum, item) => sum + item.currentValue, 0);

    const pension = valueOf("PENSION", "ASSET");
    const property = valueOf("PROPERTY", "ASSET");
    const vehicles = valueOf("VEHICLE", "ASSET");
    const otherAssets =
      valueOf("OTHER", "ASSET") + valueOf("BANK_CASH", "ASSET");
    const investments = Math.round(
      (holdingsValue + valueOf("INVESTMENT", "ASSET")) * 100,
    ) / 100;
    const mortgage = valueOf("MORTGAGE", "LIABILITY");
    const otherDebts = serialized
      .filter((item) => item.side === "LIABILITY" && item.class !== "MORTGAGE")
      .reduce((sum, item) => sum + item.currentValue, 0);

    const assets =
      bankCash +
      serialized
        .filter((item) => item.side === "ASSET")
        .reduce((sum, item) => sum + item.currentValue, 0) +
      holdingsValue;

    const liabilities = serialized
      .filter((item) => item.side === "LIABILITY")
      .reduce((sum, item) => sum + item.currentValue, 0);

    const netWorth = Math.round((assets - liabilities) * 100) / 100;
    return {
      bankCash: Math.round(bankCash * 100) / 100,
      assets: Math.round(assets * 100) / 100,
      liabilities: Math.round(liabilities * 100) / 100,
      netWorth,
      allocation: {
        cash,
        savings: Math.round(savings * 100) / 100,
        pension: Math.round(pension * 100) / 100,
        investments,
        property: Math.round(property * 100) / 100,
        vehicles: Math.round(vehicles * 100) / 100,
        otherAssets: Math.round(otherAssets * 100) / 100,
        mortgage: Math.round(mortgage * 100) / 100,
        otherDebts: Math.round(otherDebts * 100) / 100,
      },
      items: serialized,
    };
  }

  async snapshotNetWorth() {
    const userId = await this.demoUserId();
    const snapshot = await this.getNetWorth(userId);
    const asOf = new Date();
    asOf.setHours(0, 0, 0, 0);
    const saved = await this.prisma.netWorthSnapshot.upsert({
      where: { userId_asOf: { userId, asOf } },
      create: {
        userId,
        asOf,
        totalAssets: snapshot.assets,
        totalLiabilities: snapshot.liabilities,
        netWorth: snapshot.netWorth,
      },
      update: {
        totalAssets: snapshot.assets,
        totalLiabilities: snapshot.liabilities,
        netWorth: snapshot.netWorth,
      },
    });
    return {
      id: saved.id,
      asOf: saved.asOf.toISOString(),
      totalAssets: toNumber(saved.totalAssets),
      totalLiabilities: toNumber(saved.totalLiabilities),
      netWorth: toNumber(saved.netWorth),
    };
  }

  async listSnapshots() {
    const userId = await this.demoUserId();
    const rows = await this.prisma.netWorthSnapshot.findMany({
      where: { userId },
      orderBy: { asOf: "desc" },
      take: 24,
    });
    return rows.map((row) => ({
      id: row.id,
      asOf: row.asOf.toISOString(),
      totalAssets: toNumber(row.totalAssets),
      totalLiabilities: toNumber(row.totalLiabilities),
      netWorth: toNumber(row.netWorth),
    }));
  }

  async createWealthItem(input: UpsertWealthItemInput) {
    const userId = await this.demoUserId();
    const created = await this.prisma.wealthItem.create({
      data: this.wealthItemData(userId, input),
    });
    if (input.class !== "PENSION" && (input.currentValue ?? 0) > 0) {
      const asOf = input.openingAsOf
        ? prismaDateOnly(input.openingAsOf)
        : prismaDateOnly(formatDateOnly(new Date()));
      await this.prisma.wealthItemValuation.create({
        data: {
          wealthItemId: created.id,
          asOf,
          value: input.currentValue ?? 0,
          source: WealthValuationSource.OPENING,
        },
      });
    }
    return created;
  }

  async updateWealthItem(id: string, input: UpsertWealthItemInput) {
    const userId = await this.demoUserId();
    await this.requireWealthItem(userId, id);
    return this.prisma.wealthItem.update({
      where: { id },
      data: this.wealthItemData(userId, input),
    });
  }

  async deleteWealthItem(id: string) {
    const userId = await this.demoUserId();
    await this.requireWealthItem(userId, id);
    await this.prisma.wealthItem.delete({ where: { id } });
    return { deleted: true };
  }

  async assignWealthTransaction(
    id: string,
    transactionId: string,
    role: "PURCHASE" | "OPENING" | "REPAYMENT" | "INCREASE",
  ) {
    const userId = await this.demoUserId();
    await this.requireWealthItem(userId, id);
    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, account: { userId } },
    });
    if (!tx) throw new NotFoundException("Transaction not found");
    return this.prisma.wealthItemLedger.create({
      data: { wealthItemId: id, transactionId, role },
    });
  }

  async unassignWealthTransaction(id: string, transactionId: string) {
    const userId = await this.demoUserId();
    await this.requireWealthItem(userId, id);
    await this.prisma.wealthItemLedger.deleteMany({
      where: { wealthItemId: id, transactionId },
    });
    return { deleted: true };
  }

  async listWealthCandidates(id: string) {
    const userId = await this.demoUserId();
    const item = await this.requireWealthItem(userId, id);
    const assigned = await this.prisma.wealthItemLedger.findMany({
      select: { transactionId: true },
    });
    const assignedIds = assigned.map((row) => row.transactionId);
    const start = new Date();
    start.setDate(start.getDate() - 365);
    const amountFilter =
      item.side === "LIABILITY"
        ? undefined
        : { lt: 0 as const };
    const rows = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        id: { notIn: assignedIds },
        bookedAt: { gte: start },
        ...(amountFilter ? { amount: amountFilter } : {}),
      },
      orderBy: { bookedAt: "desc" },
      take: 80,
      include: {
        account: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
    const rates = await this.fx.getRates();
    return rows.map((tx) => this.serializeGoalTx("assigned", tx, rates));
  }

  async addWealthValuation(
    id: string,
    input: {
      asOf: string;
      value?: number;
      percentChange?: number;
      amountChange?: number;
      note?: string | null;
    },
  ) {
    const userId = await this.demoUserId();
    const item = await this.requireWealthItem(userId, id);
    const netWorth = await this.getNetWorth(userId);
    const current =
      netWorth.items.find((row) => row.id === id)?.currentValue ??
      toNumber(item.currentValue);
    let next = input.value;
    let source: "MANUAL_AMOUNT" | "MANUAL_PERCENT" = "MANUAL_AMOUNT";
    if (next == null && input.percentChange != null) {
      next = roundCents(current * (1 + input.percentChange / 100));
      source = "MANUAL_PERCENT";
    } else if (next == null && input.amountChange != null) {
      next = roundCents(current + input.amountChange);
    }
    if (next == null) {
      throw new BadRequestException("Provide a value, percent change, or amount change");
    }
    const asOf = prismaDateOnly(input.asOf);
    await this.prisma.wealthItemValuation.upsert({
      where: {
        wealthItemId_asOf_source: {
          wealthItemId: id,
          asOf,
          source,
        },
      },
      create: {
        wealthItemId: id,
        asOf,
        value: next,
        source,
        note: input.note ?? null,
      },
      update: { value: next, note: input.note ?? null },
    });
    await this.prisma.wealthItem.update({
      where: { id },
      data: { currentValue: next },
    });
    return { value: next };
  }

  async getWealthItemSeries(id: string) {
    const userId = await this.demoUserId();
    const item = await this.prisma.wealthItem.findFirst({
      where: { id, userId },
      include: {
        ledgers: { include: { transaction: true } },
        valuations: { orderBy: { asOf: "asc" } },
      },
    });
    if (!item) throw new NotFoundException("Item not found");
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
    });
    const rates = await this.fx.getRates();
    const now = new Date();
    const window = chartWindowFromFocus(now.getFullYear(), now.getMonth() + 1);
    const serialized = this.serializeWealthItem(item, accounts, rates);
    return {
      item: serialized,
      windowLabel: `${formatDateOnly(window.start)} – ${formatDateOnly(window.end)}`,
      points: serialized.series,
    };
  }

  async getDebts(order: "avalanche" | "snowball" = "avalanche") {
    const netWorth = await this.getNetWorth();
    const debts = netWorth.items
      .filter((item) => item.side === "LIABILITY")
      .map((item) => ({
        id: item.id,
        name: item.name,
        class: item.class,
        balance: item.currentValue,
        interestRate: item.interestRate,
        minimumPayment: item.minimumPayment,
      }));
    return order === "snowball" ? sortSnowball(debts) : sortAvalanche(debts);
  }

  async listHoldings() {
    const userId = await this.demoUserId();
    const rows = await this.prisma.holding.findMany({
      where: { userId },
      orderBy: { ticker: "asc" },
    });
    return rows.map((row) => {
      const quantity = toNumber(row.quantity);
      const averageCost = toNumber(row.averageCost);
      const lastPrice = row.lastPrice ? toNumber(row.lastPrice) : averageCost;
      return {
        id: row.id,
        ticker: row.ticker,
        name: row.name,
        quantity,
        averageCost,
        currency: row.currency,
        broker: row.broker,
        lastPrice: row.lastPrice ? toNumber(row.lastPrice) : null,
        notes: row.notes,
        marketValue: holdingMarketValue(quantity, lastPrice),
        gain: holdingGain(quantity, averageCost, lastPrice),
      };
    });
  }

  async createHolding(input: UpsertHoldingInput) {
    const userId = await this.demoUserId();
    return this.prisma.holding.create({
      data: {
        userId,
        ticker: input.ticker.toUpperCase(),
        name: input.name,
        quantity: input.quantity,
        averageCost: input.averageCost,
        currency: input.currency.toUpperCase(),
        broker: input.broker ?? null,
        lastPrice: input.lastPrice ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  async updateHolding(id: string, input: UpsertHoldingInput) {
    const userId = await this.demoUserId();
    const existing = await this.prisma.holding.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException("Holding not found");
    return this.prisma.holding.update({
      where: { id },
      data: {
        ticker: input.ticker.toUpperCase(),
        name: input.name,
        quantity: input.quantity,
        averageCost: input.averageCost,
        currency: input.currency.toUpperCase(),
        broker: input.broker ?? null,
        lastPrice: input.lastPrice ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  async deleteHolding(id: string) {
    const userId = await this.demoUserId();
    const existing = await this.prisma.holding.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException("Holding not found");
    await this.prisma.holding.delete({ where: { id } });
    return { deleted: true };
  }

  async getPensions() {
    const netWorth = await this.getNetWorth();
    return netWorth.items.filter((item) => item.class === "PENSION");
  }

  async getIncomeMix(query: SpendingPeriodInput = {}) {
    const userId = await this.demoUserId();
    const range = this.resolvePeriod(query);
    const { periodStart, periodEnd } = range;
    const budgetMonth = budgetMonthFromPeriod(range);
    const rows = await this.categoryTotals(
      userId,
      periodStart,
      periodEnd,
      CategoryKind.INCOME,
    );
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    return {
      year: budgetMonth.year,
      month: budgetMonth.month,
      periodLabel: range.label,
      total,
      sources: rows
        .sort((left, right) => right.total - left.total)
        .map((row) => ({
          categoryId: row.categoryId,
          name: row.name,
          total: row.total,
          count: row.count,
          share: total > 0 ? Math.round((row.total / total) * 1000) / 10 : 0,
        })),
    };
  }

  async getSeries(query: SpendingPeriodInput = {}) {
    const userId = await this.demoUserId();
    const range = this.resolvePeriod(query);
    const focus = budgetMonthFromPeriod(range);
    const window = chartWindowFromFocus(focus.year, focus.month);
    const now = new Date();
    const capEnd =
      window.end.getTime() > now.getTime() ? now : window.end;
    const start = new Date(window.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(capEnd);
    end.setHours(0, 0, 0, 0);
    const chartLabel = `${monthName(shiftMonth(focus.year, focus.month, -3).year, shiftMonth(focus.year, focus.month, -3).month)}–${monthName(focus.year, focus.month)} ${focus.year}`;

    const dates: string[] = [];
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      dates.push(formatDateOnly(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    const [netWorth, rates, cashTx, flowTx] = await Promise.all([
      this.getNetWorth(userId),
      this.fx.getRates(),
      this.prisma.transaction.findMany({
        where: {
          account: { userId, isActive: true },
          bookedAt: { gte: start },
        },
        select: { bookedAt: true, amount: true, currency: true },
      }),
      this.prisma.transaction.findMany({
        where: {
          isSplit: false,
          bookedAt: { gte: start, lte: end },
          account: { userId },
          category: {
            kind: { in: [CategoryKind.INCOME, CategoryKind.EXPENSE] },
            deletedAt: null,
          },
        },
        select: {
          bookedAt: true,
          amount: true,
          currency: true,
          category: { select: { kind: true } },
        },
      }),
    ]);

    const splits = await this.prisma.transactionSplit.findMany({
      where: {
        transaction: {
          isSplit: true,
          bookedAt: { gte: start, lte: end },
          account: { userId },
        },
        category: {
          kind: { in: [CategoryKind.INCOME, CategoryKind.EXPENSE] },
          deletedAt: null,
        },
      },
      select: {
        amount: true,
        category: { select: { kind: true } },
        transaction: { select: { bookedAt: true, currency: true } },
      },
    });

    const incomeByDay = new Map<string, number>();
    const spendingByDay = new Map<string, number>();
    const addFlow = (date: Date, kind: CategoryKind, amount: number, currency: string) => {
      const key = formatDateOnly(date);
      const euros = Math.abs(this.fx.toEur(amount, currency, rates));
      if (kind === CategoryKind.INCOME) {
        incomeByDay.set(key, (incomeByDay.get(key) ?? 0) + euros);
      } else {
        spendingByDay.set(key, (spendingByDay.get(key) ?? 0) + euros);
      }
    };
    for (const row of flowTx) {
      if (!row.category) continue;
      addFlow(row.bookedAt, row.category.kind, toNumber(row.amount), row.currency);
    }
    for (const row of splits) {
      addFlow(
        row.transaction.bookedAt,
        row.category.kind,
        toNumber(row.amount),
        row.transaction.currency,
      );
    }

    const afterByDay = new Map<string, number>();
    for (const row of cashTx) {
      const key = formatDateOnly(row.bookedAt);
      const euros = this.fx.toEur(toNumber(row.amount), row.currency, rates);
      afterByDay.set(key, (afterByDay.get(key) ?? 0) + euros);
    }

    const illiquidNet = Math.round((netWorth.netWorth - netWorth.bankCash) * 100) / 100;
    let remainingAfter = 0;
    for (const value of afterByDay.values()) remainingAfter += value;
    const netWorthPoints: Array<{ date: string; value: number }> = [];
    const income: Array<{ date: string; value: number }> = [];
    const spending: Array<{ date: string; value: number }> = [];
    const surplus: Array<{ date: string; value: number }> = [];
    let cumulative = 0;

    for (const date of dates) {
      remainingAfter -= afterByDay.get(date) ?? 0;
      const dayIncome = Math.round((incomeByDay.get(date) ?? 0) * 100) / 100;
      const daySpending = Math.round((spendingByDay.get(date) ?? 0) * 100) / 100;
      cumulative = Math.round((cumulative + dayIncome - daySpending) * 100) / 100;
      const cash = Math.round((netWorth.bankCash - remainingAfter) * 100) / 100;
      netWorthPoints.push({
        date,
        value: Math.round((cash + illiquidNet) * 100) / 100,
      });
      income.push({ date, value: dayIncome });
      spending.push({ date, value: daySpending });
      surplus.push({ date, value: cumulative });
    }

    return {
      periodLabel: chartLabel,
      truncated: false,
      netWorth: netWorthPoints,
      income,
      spending,
      surplus,
    };
  }

  private wealthItemData(userId: string, input: UpsertWealthItemInput) {
    return {
      userId,
      name: input.name,
      side: input.side as WealthSide,
      class: input.class as WealthClass,
      currentValue: input.currentValue ?? 0,
      accountId: input.accountId ?? null,
      interestRate: input.interestRate ?? null,
      minimumPayment: input.minimumPayment ?? null,
      pensionKind: input.pensionKind as PensionKind | null,
      employerMatchAnnual: input.employerMatchAnnual ?? null,
      employeeContributionMonthly: input.employeeContributionMonthly ?? null,
      employerContributionMonthly: input.employerContributionMonthly ?? null,
      stateContributionMonthly: input.stateContributionMonthly ?? null,
      notes: input.notes ?? null,
      depreciationPercentYearly: input.depreciationPercentYearly ?? null,
    };
  }

  private serializeWealthItem(
    item: {
      id: string;
      name: string;
      side: WealthSide;
      class: WealthClass;
      currentValue: { toString(): string };
      accountId: string | null;
      interestRate: { toString(): string } | null;
      minimumPayment: { toString(): string } | null;
      pensionKind: PensionKind | null;
      employerMatchAnnual: { toString(): string } | null;
      employeeContributionMonthly: { toString(): string } | null;
      employerContributionMonthly: { toString(): string } | null;
      stateContributionMonthly: { toString(): string } | null;
      notes: string | null;
      depreciationPercentYearly?: { toString(): string } | null;
      ledgers?: Array<{
        role: string;
        transaction: {
          amount: { toString(): string };
          currency: string;
          bookedAt: Date;
          description: string;
          payeeLabel: string | null;
          id: string;
        };
      }>;
      valuations?: Array<{
        asOf: Date;
        value: { toString(): string };
        source: string;
        note: string | null;
      }>;
    },
    accounts: Array<{
      id: string;
      name: string;
      currentBalance: { toString(): string };
      accountType?: string | null;
    }>,
    rates: Record<string, number> = {},
  ) {
    const account = item.accountId
      ? accounts.find((row) => row.id === item.accountId)
      : null;
    const stored = toNumber(item.currentValue);
    const valuations = [...(item.valuations ?? [])].sort(
      (left, right) => left.asOf.getTime() - right.asOf.getTime(),
    );
    const openingValuation = valuations.find((row) => row.source === "OPENING");
    const latestValuation = valuations.at(-1);
    const repayments = (item.ledgers ?? [])
      .filter((row) => row.role === "REPAYMENT")
      .sort(
        (left, right) =>
          left.transaction.bookedAt.getTime() - right.transaction.bookedAt.getTime(),
      );
    const increases = (item.ledgers ?? []).filter((row) => row.role === "INCREASE");
    const monthlyRate = item.interestRate
      ? toNumber(item.interestRate) / 12
      : 0;
    const opening = openingValuation
      ? toNumber(openingValuation.value)
      : stored;
    const window = chartWindowFromFocus(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
    );

    let currentValue = stored;
    let estimated = false;
    let series: Array<{ date: string; value: number }> = [];

    if (account) {
      currentValue = Math.abs(toNumber(account.currentBalance));
      series = [
        { date: formatDateOnly(window.start), value: currentValue },
        { date: formatDateOnly(window.end), value: currentValue },
      ];
    } else if (item.side === "LIABILITY") {
      const payments = repayments.map((row) => ({
        date: formatDateOnly(row.transaction.bookedAt),
        amount: Math.abs(
          this.fx.toEur(
            toNumber(row.transaction.amount),
            row.transaction.currency,
            rates,
          ),
        ),
      }));
      const extra = increases.reduce(
        (sum, row) =>
          sum +
          Math.abs(
            this.fx.toEur(
              toNumber(row.transaction.amount),
              row.transaction.currency,
              rates,
            ),
          ),
        0,
      );
      currentValue = amortiseRemaining(
        opening + extra,
        monthlyRate,
        payments.map((row) => ({ amount: row.amount })),
      );
      estimated = monthlyRate > 0;
      series = amortisePoints(
        opening + extra,
        monthlyRate,
        payments,
        formatDateOnly(window.start),
        formatDateOnly(window.end),
      );
    } else {
      const dep = item.depreciationPercentYearly
        ? toNumber(item.depreciationPercentYearly)
        : 0;
      const start = openingValuation?.asOf ?? item.valuations?.[0]?.asOf ?? new Date();
      if (latestValuation && dep <= 0) {
        currentValue = toNumber(latestValuation.value);
      } else if (dep > 0) {
        currentValue = depreciatedValue(opening, dep, start, new Date());
        estimated = true;
      }
      const cursor = new Date(window.start);
      while (cursor.getTime() <= window.end.getTime()) {
        const asOf = new Date(cursor);
        const dated = [...valuations]
          .filter((row) => row.asOf.getTime() <= asOf.getTime())
          .at(-1);
        const value =
          dep > 0
            ? depreciatedValue(opening, dep, start, asOf)
            : dated
              ? toNumber(dated.value)
              : currentValue;
        series.push({ date: formatDateOnly(asOf), value });
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return {
      id: item.id,
      name: item.name,
      side: item.side,
      class: item.class,
      currentValue: roundCents(currentValue),
      estimated,
      accountId: item.accountId,
      accountName: account?.name ?? null,
      interestRate: item.interestRate ? toNumber(item.interestRate) : null,
      minimumPayment: item.minimumPayment ? toNumber(item.minimumPayment) : null,
      depreciationPercentYearly: item.depreciationPercentYearly
        ? toNumber(item.depreciationPercentYearly)
        : null,
      pensionKind: item.pensionKind,
      employerMatchAnnual: item.employerMatchAnnual
        ? toNumber(item.employerMatchAnnual)
        : null,
      employeeContributionMonthly: item.employeeContributionMonthly
        ? toNumber(item.employeeContributionMonthly)
        : null,
      employerContributionMonthly: item.employerContributionMonthly
        ? toNumber(item.employerContributionMonthly)
        : null,
      stateContributionMonthly: item.stateContributionMonthly
        ? toNumber(item.stateContributionMonthly)
        : null,
      monthlyInflow: monthlyPensionInflow({
        employeeContributionMonthly: item.employeeContributionMonthly
          ? toNumber(item.employeeContributionMonthly)
          : 0,
        employerContributionMonthly: item.employerContributionMonthly
          ? toNumber(item.employerContributionMonthly)
          : 0,
        stateContributionMonthly: item.stateContributionMonthly
          ? toNumber(item.stateContributionMonthly)
          : 0,
        employerMatchAnnual: item.employerMatchAnnual
          ? toNumber(item.employerMatchAnnual)
          : 0,
      }),
      notes: item.notes,
      unverified: !account && (item.ledgers?.length ?? 0) === 0 && valuations.length === 0 && item.class !== "PENSION",
      trail: (item.ledgers ?? []).map((row) => ({
        transactionId: row.transaction.id,
        role: row.role,
        amount: roundCents(
          Math.abs(
            this.fx.toEur(
              toNumber(row.transaction.amount),
              row.transaction.currency,
              rates,
            ),
          ),
        ),
        bookedAt: row.transaction.bookedAt.toISOString(),
        description: row.transaction.description,
        payeeLabel: row.transaction.payeeLabel,
      })),
      valuations: valuations.map((row) => ({
        asOf: formatDateOnly(row.asOf),
        value: toNumber(row.value),
        source: row.source,
        note: row.note,
      })),
      series,
    };
  }

  private async getCashflow(userId: string, periodStart: Date, periodEnd: Date) {
    const [expenses, income] = await Promise.all([
      this.categoryTotals(userId, periodStart, periodEnd, CategoryKind.EXPENSE),
      this.categoryTotals(userId, periodStart, periodEnd, CategoryKind.INCOME),
    ]);
    const interest = income.find((row) => row.name.toLowerCase() === "interest");
    return {
      spending: expenses.reduce((sum, row) => sum + row.total, 0),
      income: income.reduce((sum, row) => sum + row.total, 0),
      interestGross: interest?.total ?? 0,
    };
  }

  private async categoryTotals(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    kind: CategoryKind,
  ) {
    const amount = kind === CategoryKind.INCOME ? { gte: 0 } : { lt: 0 };
    const rates = await this.fx.getRates();
    const [unsplit, splits, categories] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          isSplit: false,
          amount,
          bookedAt: { gte: periodStart, lte: periodEnd },
          account: { userId },
          category: { kind, deletedAt: null },
        },
        select: { categoryId: true, amount: true, currency: true },
      }),
      this.prisma.transactionSplit.findMany({
        where: {
          amount,
          transaction: {
            isSplit: true,
            bookedAt: { gte: periodStart, lte: periodEnd },
            account: { userId },
          },
          category: { kind, deletedAt: null },
        },
        select: {
          categoryId: true,
          amount: true,
          transaction: { select: { currency: true } },
        },
      }),
      this.prisma.category.findMany({
        where: { userId, kind, deletedAt: null },
      }),
    ]);

    const totals = new Map<string, { total: number; count: number }>();
    for (const row of unsplit) {
      if (!row.categoryId) continue;
      const current = totals.get(row.categoryId) ?? { total: 0, count: 0 };
      current.total += Math.abs(this.fx.toEur(toNumber(row.amount), row.currency, rates));
      current.count += 1;
      totals.set(row.categoryId, current);
    }
    for (const row of splits) {
      const current = totals.get(row.categoryId) ?? { total: 0, count: 0 };
      current.total += Math.abs(
        this.fx.toEur(toNumber(row.amount), row.transaction.currency, rates),
      );
      current.count += 1;
      totals.set(row.categoryId, current);
    }

    return categories.map((category) => ({
      categoryId: category.id,
      name: category.name,
      total: Math.round((totals.get(category.id)?.total ?? 0) * 100) / 100,
      count: totals.get(category.id)?.count ?? 0,
    }));
  }

  private async merchantTotals(userId: string, periodStart: Date, periodEnd: Date) {
    const rates = await this.fx.getRates();
    const rows = await this.prisma.transaction.findMany({
      where: {
        amount: { lt: 0 },
        bookedAt: { gte: periodStart, lte: periodEnd },
        account: { userId },
        category: { kind: CategoryKind.EXPENSE, deletedAt: null },
      },
      select: { payeeLabel: true, description: true, amount: true, currency: true },
    });
    const grouped = new Map<string, { total: number; count: number }>();
    for (const row of rows) {
      const payee = row.payeeLabel?.trim() || row.description.slice(0, 40);
      const current = grouped.get(payee) ?? { total: 0, count: 0 };
      current.total += Math.abs(this.fx.toEur(toNumber(row.amount), row.currency, rates));
      current.count += 1;
      grouped.set(payee, current);
    }
    return [...grouped.entries()]
      .map(([payee, stats]) => ({
        payee,
        total: Math.round(stats.total * 100) / 100,
        count: stats.count,
      }))
      .sort((left, right) => right.total - left.total);
  }

  private async timePatterns(userId: string, periodStart: Date, periodEnd: Date) {
    const rates = await this.fx.getRates();
    const rows = await this.prisma.transaction.findMany({
      where: {
        amount: { lt: 0 },
        bookedAt: { gte: periodStart, lte: periodEnd },
        account: { userId },
        category: { kind: CategoryKind.EXPENSE, deletedAt: null },
      },
      select: { bookedAt: true, amount: true, currency: true },
    });
    let weekend = 0;
    let weekday = 0;
    let early = 0;
    let late = 0;
    for (const row of rows) {
      const amount = Math.abs(this.fx.toEur(toNumber(row.amount), row.currency, rates));
      const day = row.bookedAt.getDay();
      if (day === 0 || day === 5 || day === 6) weekend += amount;
      else weekday += amount;
      if (row.bookedAt.getDate() >= 22) late += amount;
      else early += amount;
    }
    return {
      weekday: Math.round(weekday * 100) / 100,
      weekend: Math.round(weekend * 100) / 100,
      early: Math.round(early * 100) / 100,
      late: Math.round(late * 100) / 100,
    };
  }

  private async leakTotals(userId: string, periodStart: Date, periodEnd: Date) {
    const rates = await this.fx.getRates();
    const rows = await this.prisma.transaction.findMany({
      where: {
        amount: { lt: 0 },
        bookedAt: { gte: periodStart, lte: periodEnd },
        account: { userId },
        category: { kind: CategoryKind.EXPENSE, deletedAt: null },
      },
      select: {
        amount: true,
        currency: true,
        payeeLabel: true,
        description: true,
        category: { select: { id: true, name: true } },
      },
    });

    const buckets = {
      atm: {
        id: "atm" as const,
        label: "ATM cash not assigned",
        total: 0,
        count: 0,
        categoryId: null as string | null,
      },
      other: {
        id: "other" as const,
        label: "Still sitting in Other",
        total: 0,
        count: 0,
        categoryId: null as string | null,
      },
      revolut: {
        id: "revolut" as const,
        label: "Revolut card top-ups counted as spend",
        total: 0,
        count: 0,
        categoryId: null as string | null,
      },
    };

    for (const row of rows) {
      const amount = Math.abs(this.fx.toEur(toNumber(row.amount), row.currency, rates));
      const category = row.category?.name.toLowerCase() ?? "";
      const haystack = `${row.payeeLabel ?? ""} ${row.description}`.toLowerCase();
      if (category === "atm") {
        buckets.atm.total += amount;
        buckets.atm.count += 1;
        buckets.atm.categoryId = row.category?.id ?? buckets.atm.categoryId;
      } else if (category === "other") {
        buckets.other.total += amount;
        buckets.other.count += 1;
        buckets.other.categoryId = row.category?.id ?? buckets.other.categoryId;
      }
      if (/revolut/.test(haystack) && category !== "atm") {
        buckets.revolut.total += amount;
        buckets.revolut.count += 1;
      }
    }

    return Object.values(buckets).map((bucket) => ({
      ...bucket,
      total: Math.round(bucket.total * 100) / 100,
    }));
  }

  private serializeGoalTx(
    source: "account" | "assigned",
    tx: {
      id: string;
      amount: { toString(): string };
      currency: string;
      bookedAt: Date;
      description: string;
      payeeLabel: string | null;
      account: { id: string; name: string };
      category: { id: string; name: string } | null;
    },
    rates: Record<string, number>,
  ) {
    return {
      id: tx.id,
      transactionId: tx.id,
      source,
      amount: Math.round(
        Math.abs(this.fx.toEur(toNumber(tx.amount), tx.currency, rates)) * 100,
      ) / 100,
      bookedAt: tx.bookedAt.toISOString(),
      description: tx.description,
      payeeLabel: tx.payeeLabel,
      accountId: tx.account.id,
      accountName: tx.account.name,
      categoryId: tx.category?.id ?? null,
      categoryName: tx.category?.name ?? null,
    };
  }

  private async requireGoalAccount(userId: string, accountId?: string | null) {
    if (!accountId) return null;
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, isActive: true },
    });
    if (!account) throw new NotFoundException("Account not found");
    return account.id;
  }

  private async requireBill(userId: string, id: string) {
    const bill = await this.prisma.recurringBill.findFirst({ where: { id, userId } });
    if (!bill) throw new NotFoundException("Bill not found");
    return bill;
  }

  private async requireGoal(userId: string, id: string) {
    const goal = await this.prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!goal) throw new NotFoundException("Goal not found");
    return goal;
  }

  private async requireWealthItem(userId: string, id: string) {
    const item = await this.prisma.wealthItem.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException("Item not found");
    return item;
  }
}
