import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CategoryKind,
  type PensionKind,
  type WealthClass,
  type WealthSide,
} from "@poca/db";
import type {
  CopyBudgetInput,
  UpsertBillInput,
  UpsertBudgetInput,
  UpsertGoalInput,
  UpsertHoldingInput,
  UpsertWealthItemInput,
} from "@poca/shared";
import {
  afterDirt,
  emergencyFundTarget,
  holdingGain,
  holdingMarketValue,
  monthlyFromCadence,
  remainingBudget,
  savingsRate,
  sortAvalanche,
  sortSnowball,
} from "@poca/shared";
import { PrismaService } from "../prisma/prisma.module";
import { CategoriesService } from "../spending/categories.service";
import { FxService } from "../fx/fx.service";

function toNumber(value: { toString(): string }): number {
  return parseFloat(value.toString());
}

function monthBounds(year: number, month: number) {
  const periodStart = new Date(year, month - 1, 1);
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date(year, month, 0);
  periodEnd.setHours(23, 59, 59, 999);
  return { periodStart, periodEnd };
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
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

  async getOverview(year?: number, month?: number) {
    const userId = await this.demoUserId();
    const period = this.resolveMonth(year, month);
    const [budget, cashflow, netWorth, bills, goals, habits] = await Promise.all([
      this.getBudget(period.year, period.month),
      this.getCashflow(userId, period.year, period.month),
      this.getNetWorth(userId),
      this.listBills(),
      this.listGoals(),
      this.getHabits(period.year, period.month),
    ]);

    const essentialMonthly = bills
      .filter((bill) => bill.isEssential)
      .reduce((sum, bill) => sum + bill.monthlyAmount, 0);
    const emergencyTarget = emergencyFundTarget(essentialMonthly, 3);
    const emergencyGoal = goals.find((goal) => goal.kind === "EMERGENCY");
    const emergencySaved = emergencyGoal?.currentAmount ?? 0;

    return {
      year: period.year,
      month: period.month,
      income: cashflow.income,
      spending: cashflow.spending,
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
      essentialMonthly,
      emergencyTarget,
      emergencySaved,
      habitAlerts: habits.alerts.length,
    };
  }

  async getBudget(year?: number, month?: number) {
    const userId = await this.demoUserId();
    const period = this.resolveMonth(year, month);
    const { periodStart, periodEnd } = monthBounds(period.year, period.month);
    const [budget, spentRows, categories] = await Promise.all([
      this.prisma.monthlyBudget.findUnique({
        where: {
          userId_year_month: { userId, year: period.year, month: period.month },
        },
        include: { lines: true },
      }),
      this.categoryTotals(userId, periodStart, periodEnd, CategoryKind.EXPENSE),
      this.prisma.category.findMany({
        where: { userId, kind: CategoryKind.EXPENSE, deletedAt: null },
        orderBy: { name: "asc" },
      }),
    ]);

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
      };
    });

    const totalBudgeted = lines.reduce((sum, line) => sum + line.amount, 0);
    const totalSpent = lines.reduce((sum, line) => sum + line.spent, 0);

    return {
      id: budget?.id ?? null,
      year: period.year,
      month: period.month,
      overallCap: budget?.overallCap ? toNumber(budget.overallCap) : null,
      totalBudgeted,
      totalSpent,
      remaining: remainingBudget(totalBudgeted, totalSpent),
      lines,
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

    return this.getBudget(input.year, input.month);
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

  async getHabits(year?: number, month?: number) {
    const userId = await this.demoUserId();
    const period = this.resolveMonth(year, month);
    const previous = shiftMonth(period.year, period.month, -1);
    const currentBounds = monthBounds(period.year, period.month);
    const previousBounds = monthBounds(previous.year, previous.month);
    const [budget, merchants, previousMerchants, timeSplit, leaks] = await Promise.all([
      this.getBudget(period.year, period.month),
      this.merchantTotals(userId, currentBounds.periodStart, currentBounds.periodEnd),
      this.merchantTotals(userId, previousBounds.periodStart, previousBounds.periodEnd),
      this.weekdaySplit(userId, currentBounds.periodStart, currentBounds.periodEnd),
      this.leakTotals(userId, currentBounds.periodStart, currentBounds.periodEnd),
    ]);

    const previousByPayee = new Map(previousMerchants.map((row) => [row.payee, row.total]));
    const overBudget = budget.lines
      .filter((line) => line.amount > 0 && line.spent > line.amount)
      .map((line) => ({
        type: "over-budget" as const,
        title: `${line.name} is over budget`,
        detail: `€${line.spent.toFixed(2)} spent of €${line.amount.toFixed(2)}`,
      }));

    const repeats = merchants.slice(0, 8).map((row) => {
      const last = previousByPayee.get(row.payee) ?? 0;
      return {
        payee: row.payee,
        count: row.count,
        total: row.total,
        previousTotal: last,
      };
    });

    const alerts = [
      ...overBudget,
      ...leaks
        .filter((leak) => leak.total > 0)
        .map((leak) => ({
          type: "leak" as const,
          title: leak.label,
          detail: `€${leak.total.toFixed(2)} this month · ${leak.count} times`,
        })),
    ];

    if (budget.overallCap && budget.totalSpent > budget.overallCap) {
      alerts.unshift({
        type: "over-budget",
        title: "Overall monthly cap exceeded",
        detail: `€${budget.totalSpent.toFixed(2)} spent of €${budget.overallCap.toFixed(2)}`,
      });
    }

    return {
      year: period.year,
      month: period.month,
      alerts,
      overBudget,
      merchants: repeats,
      weekday: timeSplit,
      leaks,
    };
  }

  async listBills() {
    const userId = await this.demoUserId();
    const bills = await this.prisma.recurringBill.findMany({
      where: { userId },
      include: { category: { select: { id: true, name: true, color: true } } },
      orderBy: { name: "asc" },
    });
    return bills.map((bill) => {
      const typicalAmount = toNumber(bill.typicalAmount);
      return {
        id: bill.id,
        name: bill.name,
        categoryId: bill.categoryId,
        categoryName: bill.category?.name ?? null,
        payeeMatch: bill.payeeMatch,
        typicalAmount,
        cadence: bill.cadence,
        nextDue: bill.nextDue?.toISOString() ?? null,
        isEssential: bill.isEssential,
        notes: bill.notes,
        monthlyAmount: monthlyFromCadence(typicalAmount, bill.cadence),
      };
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
    return this.prisma.recurringBill.create({
      data: {
        userId,
        name: input.name,
        categoryId: input.categoryId ?? null,
        payeeMatch: input.payeeMatch ?? null,
        typicalAmount: input.typicalAmount,
        cadence: input.cadence,
        nextDue: input.nextDue ? new Date(input.nextDue) : null,
        isEssential: input.isEssential,
        notes: input.notes ?? null,
      },
    });
  }

  async updateBill(id: string, input: UpsertBillInput) {
    const userId = await this.demoUserId();
    await this.requireBill(userId, id);
    return this.prisma.recurringBill.update({
      where: { id },
      data: {
        name: input.name,
        categoryId: input.categoryId ?? null,
        payeeMatch: input.payeeMatch ?? null,
        typicalAmount: input.typicalAmount,
        cadence: input.cadence,
        nextDue: input.nextDue ? new Date(input.nextDue) : null,
        isEssential: input.isEssential,
        notes: input.notes ?? null,
      },
    });
  }

  async deleteBill(id: string) {
    const userId = await this.demoUserId();
    await this.requireBill(userId, id);
    await this.prisma.recurringBill.delete({ where: { id } });
    return { deleted: true };
  }

  async listGoals() {
    const userId = await this.demoUserId();
    const bills = await this.listBills();
    const essentialMonthly = bills
      .filter((bill) => bill.isEssential)
      .reduce((sum, bill) => sum + bill.monthlyAmount, 0);
    const suggestedEmergency = emergencyFundTarget(essentialMonthly, 3);
    const goals = await this.prisma.savingsGoal.findMany({
      where: { userId },
      include: { account: { select: { id: true, name: true, currentBalance: true } } },
      orderBy: { createdAt: "asc" },
    });
    return goals.map((goal) => {
      const linked = goal.account ? toNumber(goal.account.currentBalance) : null;
      const currentAmount = linked ?? toNumber(goal.currentAmount);
      const targetAmount = toNumber(goal.targetAmount);
      return {
        id: goal.id,
        name: goal.name,
        kind: goal.kind,
        targetAmount,
        targetDate: goal.targetDate?.toISOString() ?? null,
        currentAmount,
        accountId: goal.accountId,
        accountName: goal.account?.name ?? null,
        notes: goal.notes,
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
    return this.prisma.savingsGoal.create({
      data: {
        userId,
        name: input.name,
        kind: input.kind,
        targetAmount: input.targetAmount,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        currentAmount: input.currentAmount,
        accountId: input.accountId ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  async updateGoal(id: string, input: UpsertGoalInput) {
    const userId = await this.demoUserId();
    await this.requireGoal(userId, id);
    return this.prisma.savingsGoal.update({
      where: { id },
      data: {
        name: input.name,
        kind: input.kind,
        targetAmount: input.targetAmount,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        currentAmount: input.currentAmount,
        accountId: input.accountId ?? null,
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
    const [accounts, items, holdings] = await Promise.all([
      this.prisma.account.findMany({ where: { userId: id, isActive: true } }),
      this.prisma.wealthItem.findMany({ where: { userId: id } }),
      this.prisma.holding.findMany({ where: { userId: id } }),
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

    const assets =
      bankCash +
      items
        .filter((item) => item.side === "ASSET")
        .reduce((sum, item) => {
          if (item.accountId) {
            const account = accounts.find((row) => row.id === item.accountId);
            return sum + (account ? Math.max(toNumber(account.currentBalance), 0) : toNumber(item.currentValue));
          }
          return sum + toNumber(item.currentValue);
        }, 0) +
      holdings.reduce((sum, holding) => {
        const price = holding.lastPrice
          ? toNumber(holding.lastPrice)
          : toNumber(holding.averageCost);
        return sum + holdingMarketValue(toNumber(holding.quantity), price);
      }, 0);

    const liabilities = items
      .filter((item) => item.side === "LIABILITY")
      .reduce((sum, item) => sum + toNumber(item.currentValue), 0);

    const netWorth = Math.round((assets - liabilities) * 100) / 100;
    return {
      bankCash: Math.round(bankCash * 100) / 100,
      assets: Math.round(assets * 100) / 100,
      liabilities: Math.round(liabilities * 100) / 100,
      netWorth,
      items: items.map((item) => this.serializeWealthItem(item, accounts)),
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
    return this.prisma.wealthItem.create({
      data: this.wealthItemData(userId, input),
    });
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

  async getIncomeMix(year?: number, month?: number) {
    const userId = await this.demoUserId();
    const period = this.resolveMonth(year, month);
    const { periodStart, periodEnd } = monthBounds(period.year, period.month);
    const rows = await this.categoryTotals(
      userId,
      periodStart,
      periodEnd,
      CategoryKind.INCOME,
    );
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    return {
      year: period.year,
      month: period.month,
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

  private wealthItemData(userId: string, input: UpsertWealthItemInput) {
    return {
      userId,
      name: input.name,
      side: input.side as WealthSide,
      class: input.class as WealthClass,
      currentValue: input.currentValue,
      accountId: input.accountId ?? null,
      interestRate: input.interestRate ?? null,
      minimumPayment: input.minimumPayment ?? null,
      pensionKind: input.pensionKind as PensionKind | null,
      employerMatchAnnual: input.employerMatchAnnual ?? null,
      notes: input.notes ?? null,
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
      notes: string | null;
    },
    accounts: Array<{ id: string; name: string; currentBalance: { toString(): string } }>,
  ) {
    const account = item.accountId
      ? accounts.find((row) => row.id === item.accountId)
      : null;
    const currentValue = account
      ? Math.max(toNumber(account.currentBalance), 0)
      : toNumber(item.currentValue);
    return {
      id: item.id,
      name: item.name,
      side: item.side,
      class: item.class,
      currentValue,
      accountId: item.accountId,
      accountName: account?.name ?? null,
      interestRate: item.interestRate ? toNumber(item.interestRate) : null,
      minimumPayment: item.minimumPayment ? toNumber(item.minimumPayment) : null,
      pensionKind: item.pensionKind,
      employerMatchAnnual: item.employerMatchAnnual
        ? toNumber(item.employerMatchAnnual)
        : null,
      notes: item.notes,
    };
  }

  private async getCashflow(userId: string, year: number, month: number) {
    const { periodStart, periodEnd } = monthBounds(year, month);
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

  private async weekdaySplit(userId: string, periodStart: Date, periodEnd: Date) {
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
    for (const row of rows) {
      const amount = Math.abs(this.fx.toEur(toNumber(row.amount), row.currency, rates));
      const day = row.bookedAt.getDay();
      if (day === 0 || day === 6) weekend += amount;
      else weekday += amount;
    }
    return {
      weekday: Math.round(weekday * 100) / 100,
      weekend: Math.round(weekend * 100) / 100,
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
        category: { select: { name: true } },
      },
    });

    const buckets = {
      atm: { label: "ATM cash you haven't placed", total: 0, count: 0 },
      other: { label: "Still in Other", total: 0, count: 0 },
      revolut: { label: "Revolut card top-ups", total: 0, count: 0 },
    };

    for (const row of rows) {
      const amount = Math.abs(this.fx.toEur(toNumber(row.amount), row.currency, rates));
      const category = row.category?.name.toLowerCase() ?? "";
      const haystack = `${row.payeeLabel ?? ""} ${row.description}`.toLowerCase();
      if (category === "atm") {
        buckets.atm.total += amount;
        buckets.atm.count += 1;
      } else if (category === "other") {
        buckets.other.total += amount;
        buckets.other.count += 1;
      }
      if (/revolut/.test(haystack)) {
        buckets.revolut.total += amount;
        buckets.revolut.count += 1;
      }
    }

    return Object.values(buckets).map((bucket) => ({
      ...bucket,
      total: Math.round(bucket.total * 100) / 100,
    }));
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
