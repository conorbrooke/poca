import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CategoryDetailResponse,
  SpendingQuery,
  SpendingRangeId,
  SpendingSummaryResponse,
  SpendingTransactionsQuery,
} from "@poca/shared";
import { Prisma } from "@poca/db";
import { PrismaService } from "../prisma/prisma.module";
import { CategoriesService } from "./categories.service";
import { resolveSpendingPeriod, roundMoney, toDateOnly } from "./period";

function toNumber(value: { toString(): string }): number {
  return parseFloat(value.toString());
}

@Injectable()
export class SpendingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async getSummary(
    userId: string,
    query: SpendingQuery,
  ): Promise<SpendingSummaryResponse> {
    await this.categoriesService.ensureDefaults(userId);
    const { periodStart, periodEnd } = resolveSpendingPeriod(query.range);
    const bankConnectionId = query.bankConnectionId ?? null;

    const cached = await this.prisma.categoryPeriodStat.findMany({
      where: {
        userId,
        rangeType: query.range,
        periodStart: toDateOnly(periodStart),
        periodEnd: toDateOnly(periodEnd),
        bankConnectionId,
      },
      include: { category: true },
      orderBy: { totalSpent: "desc" },
    });

    if (cached.length > 0) {
      const totalSpent = roundMoney(
        cached.reduce((sum, row) => sum + toNumber(row.totalSpent), 0),
      );
      const transactionCount = cached.reduce(
        (sum, row) => sum + row.transactionCount,
        0,
      );

      return {
        range: query.range,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        totalSpent,
        transactionCount,
        cached: true,
        categories: cached.map((row) => ({
          id: row.categoryId,
          name: row.category.name,
          color: row.category.color,
          icon: row.category.icon,
          isSystem: row.category.isSystem,
          totalSpent: toNumber(row.totalSpent),
          transactionCount: row.transactionCount,
          share:
            totalSpent > 0
              ? roundMoney((toNumber(row.totalSpent) / totalSpent) * 100)
              : 0,
        })),
      };
    }

    return this.computeAndCacheSummary(userId, query.range, bankConnectionId);
  }

  async getCategoryDetail(
    userId: string,
    categoryId: string,
    query: SpendingQuery,
  ): Promise<CategoryDetailResponse> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) throw new NotFoundException("Category not found");

    const summary = await this.getSummary(userId, query);
    const categorySummary = summary.categories.find((item) => item.id === categoryId);

    const { periodStart, periodEnd } = resolveSpendingPeriod(query.range);
    const bankConnectionId = query.bankConnectionId ?? null;

    const cachedStat = await this.prisma.categoryPeriodStat.findFirst({
      where: {
        userId,
        categoryId,
        rangeType: query.range,
        periodStart: toDateOnly(periodStart),
        periodEnd: toDateOnly(periodEnd),
        bankConnectionId,
      },
      include: {
        payees: {
          orderBy: { totalSpent: "desc" },
        },
      },
    });

    let payees =
      cachedStat?.payees.map((payee) => ({
        payeeLabel: payee.payeeLabel,
        totalSpent: toNumber(payee.totalSpent),
        transactionCount: payee.transactionCount,
        share: 0,
      })) ?? [];

    if (payees.length === 0) {
      payees = await this.computePayeeBreakdown(
        userId,
        categoryId,
        periodStart,
        periodEnd,
        bankConnectionId,
      );
    }

    const totalSpent = categorySummary?.totalSpent ?? 0;
    payees = payees.map((payee) => ({
      ...payee,
      share:
        totalSpent > 0
          ? roundMoney((payee.totalSpent / totalSpent) * 100)
          : 0,
    }));

    return {
      category: {
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        isSystem: category.isSystem,
      },
      range: query.range,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalSpent,
      transactionCount: categorySummary?.transactionCount ?? 0,
      payees,
      cached: Boolean(cachedStat),
    };
  }

  async listCategoryTransactions(
    userId: string,
    categoryId: string,
    query: SpendingTransactionsQuery,
  ) {
    const { periodStart, periodEnd } = resolveSpendingPeriod(query.range);
    const accountWhere: Prisma.AccountWhereInput = {
      userId,
      ...(query.bankConnectionId ? { bankConnectionId: query.bankConnectionId } : {}),
    };

    const cursorFilter = query.cursor
      ? this.buildCursorFilter(JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")))
      : undefined;

    const rows = await this.prisma.transaction.findMany({
      where: {
        categoryId,
        account: accountWhere,
        amount: { lt: 0 },
        bookedAt: { gte: periodStart, lte: periodEnd },
        ...(query.payeeLabel ? { payeeLabel: query.payeeLabel } : {}),
        ...cursorFilter,
      },
      take: query.limit + 1,
      orderBy: [{ bookedAt: "desc" }, { id: "desc" }],
      include: {
        account: {
          include: {
            bankConnection: { select: { institutionName: true } },
          },
        },
        category: true,
      },
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page.at(-1);

    return {
      transactions: page.map((tx) => ({
        id: tx.id,
        amount: toNumber(tx.amount),
        currency: tx.currency,
        description: tx.description,
        merchant: tx.merchant,
        payeeLabel: tx.payeeLabel,
        bookedAt: tx.bookedAt.toISOString(),
        categoryId: tx.categoryId,
        categoryName: tx.category?.name ?? null,
        institutionName: tx.account.bankConnection?.institutionName ?? "",
      })),
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ bookedAt: last.bookedAt.toISOString(), id: last.id }),
            ).toString("base64url")
          : null,
    };
  }

  private async computeAndCacheSummary(
    userId: string,
    range: SpendingRangeId,
    bankConnectionId: string | null,
  ): Promise<SpendingSummaryResponse> {
    const { periodStart, periodEnd } = resolveSpendingPeriod(range);
    const accountFilter: Prisma.AccountWhereInput = {
      userId,
      ...(bankConnectionId ? { bankConnectionId } : {}),
    };

    await this.prisma.categoryPeriodStat.deleteMany({
      where: {
        userId,
        rangeType: range,
        periodStart: toDateOnly(periodStart),
        periodEnd: toDateOnly(periodEnd),
        bankConnectionId,
      },
    });

    const grouped = await this.prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        account: accountFilter,
        amount: { lt: 0 },
        bookedAt: { gte: periodStart, lte: periodEnd },
        categoryId: { not: null },
      },
      _sum: { amount: true },
      _count: { _all: true },
    });

    const categories = await this.prisma.category.findMany({ where: { userId } });
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const rows = grouped
      .map((row) => {
        const category = row.categoryId ? categoryMap.get(row.categoryId) : null;
        if (!category) return null;
        const totalSpent = roundMoney(Math.abs(toNumber(row._sum.amount ?? 0)));
        return {
          category,
          totalSpent,
          transactionCount: row._count._all,
        };
      })
      .filter(Boolean) as Array<{
      category: (typeof categories)[number];
      totalSpent: number;
      transactionCount: number;
    }>;

    rows.sort((a, b) => b.totalSpent - a.totalSpent);

    const totalSpent = roundMoney(rows.reduce((sum, row) => sum + row.totalSpent, 0));
    const transactionCount = rows.reduce((sum, row) => sum + row.transactionCount, 0);

    for (const row of rows) {
      const payees = await this.computePayeeBreakdown(
        userId,
        row.category.id,
        periodStart,
        periodEnd,
        bankConnectionId,
      );

      const stat = await this.prisma.categoryPeriodStat.create({
        data: {
          userId,
          categoryId: row.category.id,
          bankConnectionId,
          rangeType: range,
          periodStart: toDateOnly(periodStart),
          periodEnd: toDateOnly(periodEnd),
          totalSpent: row.totalSpent,
          transactionCount: row.transactionCount,
          payees: {
            create: payees.map((payee) => ({
              payeeLabel: payee.payeeLabel,
              totalSpent: payee.totalSpent,
              transactionCount: payee.transactionCount,
            })),
          },
        },
      });
      void stat;
    }

    return {
      range,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalSpent,
      transactionCount,
      cached: false,
      categories: rows.map((row) => ({
        id: row.category.id,
        name: row.category.name,
        color: row.category.color,
        icon: row.category.icon,
        isSystem: row.category.isSystem,
        totalSpent: row.totalSpent,
        transactionCount: row.transactionCount,
        share:
          totalSpent > 0
            ? roundMoney((row.totalSpent / totalSpent) * 100)
            : 0,
      })),
    };
  }

  private async computePayeeBreakdown(
    userId: string,
    categoryId: string,
    periodStart: Date,
    periodEnd: Date,
    bankConnectionId: string | null,
  ) {
    const grouped = await this.prisma.transaction.groupBy({
      by: ["payeeLabel"],
      where: {
        categoryId,
        account: {
          userId,
          ...(bankConnectionId ? { bankConnectionId } : {}),
        },
        amount: { lt: 0 },
        bookedAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
      _count: { _all: true },
    });

    return grouped
      .map((row) => ({
        payeeLabel: row.payeeLabel ?? "Unknown",
        totalSpent: roundMoney(Math.abs(toNumber(row._sum.amount ?? 0))),
        transactionCount: row._count._all,
        share: 0,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }

  private buildCursorFilter(cursor: {
    bookedAt: string;
    id: string;
  }): Prisma.TransactionWhereInput {
    const bookedAt = new Date(cursor.bookedAt);
    return {
      OR: [
        { bookedAt: { lt: bookedAt } },
        { bookedAt, id: { lt: cursor.id } },
      ],
    };
  }
}
