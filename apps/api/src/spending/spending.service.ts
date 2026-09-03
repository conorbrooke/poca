import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CategoryDetailResponse,
  ReplaceSplitsInput,
  ResolvedSpendingPeriod,
  SpendingQuery,
  SpendingSummaryResponse,
  SpendingTransaction,
  SpendingTransactionsQuery,
  TransactionDetail,
  UnsplitTransactionInput,
  UpdateSplitInput,
} from "@poca/shared";
import { isIncomeCategoryKind, isSpendingCategoryKind } from "@poca/shared";
import { Prisma } from "@poca/db";
import { PrismaService } from "../prisma/prisma.module";
import { FxService } from "../fx/fx.service";
import { CategoriesService } from "./categories.service";
import { mapTag, splitsOutOfBalance, toNumber } from "./mappers";
import { resolveSpendingPeriod, roundMoney, toDateOnly } from "./period";
import { TransfersService } from "./transfers.service";

const tagInclude = {
  tag: { select: { id: true, name: true, color: true, icon: true } },
} as const;

type CashFlow = "in" | "out";

function amountFilter(flow: CashFlow): Prisma.DecimalFilter {
  return flow === "in" ? { gt: 0 } : { lt: 0 };
}

@Injectable()
export class SpendingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
    private readonly transfersService: TransfersService,
    private readonly fx: FxService,
  ) {}

  async getSummary(
    userId: string,
    query: SpendingQuery,
  ): Promise<SpendingSummaryResponse> {
    await this.categoriesService.ensureDefaults(userId);
    const period = resolveSpendingPeriod(query);
    const { periodStart, periodEnd } = period;
    const bankConnectionId = query.bankConnectionId ?? null;
    const tagIds = query.tagIds;
    const flow = query.flow ?? "out";

    if (flow === "out" && !tagIds?.length) {
      const cached = await this.prisma.categoryPeriodStat.findMany({
        where: {
          userId,
          rangeType: period.cacheKey,
          periodStart: toDateOnly(periodStart),
          periodEnd: toDateOnly(periodEnd),
          bankConnectionId,
        },
        include: { category: true },
        orderBy: { totalSpent: "desc" },
      });

      if (
        cached.length > 0 &&
        this.fx.isConvertedCacheFresh(cached[0]!.computedAt)
      ) {
        return this.buildSummaryFromRows(
          period,
          cached.map((row) => ({
            category: row.category,
            totalSpent: toNumber(row.totalSpent),
            transactionCount: row.transactionCount,
          })),
          true,
          "out",
        );
      }
    }

    return this.computeAndCacheSummary(
      userId,
      period,
      bankConnectionId,
      tagIds,
      flow,
    );
  }

  async getCategoryDetail(
    userId: string,
    categoryId: string,
    query: SpendingQuery,
  ): Promise<CategoryDetailResponse> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId, deletedAt: null },
    });
    if (!category) throw new NotFoundException("Category not found");

    const summary = await this.getSummary(userId, query);
    const categorySummary =
      summary.categories.find((item) => item.id === categoryId) ??
      summary.transferCategories.find((item) => item.id === categoryId) ??
      (summary.transfersCategory?.id === categoryId
        ? summary.transfersCategory
        : undefined) ??
      summary.reviewCategories.find((item) => item.id === categoryId);
    const period = resolveSpendingPeriod(query);
    const { periodStart, periodEnd } = period;
    const bankConnectionId = query.bankConnectionId ?? null;
    const flow = query.flow ?? "out";

    let payees: CategoryDetailResponse["payees"] = [];
    if (flow === "out" && !query.tagIds?.length) {
      const cachedStat = await this.prisma.categoryPeriodStat.findFirst({
        where: {
          userId,
          categoryId,
          rangeType: period.cacheKey,
          periodStart: toDateOnly(periodStart),
          periodEnd: toDateOnly(periodEnd),
          bankConnectionId,
        },
        include: { payees: { orderBy: { totalSpent: "desc" } } },
      });
      if (cachedStat && this.fx.isConvertedCacheFresh(cachedStat.computedAt)) {
        payees = cachedStat.payees.map((payee) => ({
          payeeLabel: payee.payeeLabel,
          totalSpent: toNumber(payee.totalSpent),
          transactionCount: payee.transactionCount,
          share: 0,
        }));
      }
    }

    if (payees.length === 0) {
      payees = await this.computePayeeBreakdown(
        userId,
        categoryId,
        periodStart,
        periodEnd,
        bankConnectionId,
        query.tagIds,
        flow,
      );
    }

    const totalSpent = categorySummary?.totalSpent ?? 0;
    payees = payees.map((payee) => ({
      ...payee,
      share:
        totalSpent > 0 ? roundMoney((payee.totalSpent / totalSpent) * 100) : 0,
    }));

    return {
      category: {
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        isSystem: category.isSystem,
        kind: category.kind,
      },
      range: period.kind,
      periodLabel: period.label,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalSpent,
      transactionCount: categorySummary?.transactionCount ?? 0,
      payees,
      cached: !query.tagIds?.length,
    };
  }

  async listCategoryTransactions(
    userId: string,
    categoryId: string,
    query: SpendingTransactionsQuery,
  ) {
    return this.listAllocatableTransactions(userId, query, categoryId);
  }

  async listAllocatableTransactions(
    userId: string,
    query: SpendingTransactionsQuery,
    categoryId?: string,
  ) {
    const { periodStart, periodEnd } = resolveSpendingPeriod(query);
    const accountWhere: Prisma.AccountWhereInput = {
      userId,
      ...(query.bankConnectionId ? { bankConnectionId: query.bankConnectionId } : {}),
    };
    const tagFilter = this.tagAndFilter(query.tagIds);
    const flow = query.flow ?? "out";
    const amount = amountFilter(flow);
    const rates = await this.fx.getRates();

    const unsplit = await this.prisma.transaction.findMany({
      where: {
        isSplit: false,
        amount,
        bookedAt: { gte: periodStart, lte: periodEnd },
        account: accountWhere,
        ...(categoryId ? { categoryId } : {}),
        ...(query.payeeLabel ? { payeeLabel: query.payeeLabel } : {}),
        ...tagFilter,
      },
      include: {
        category: true,
        tags: { include: tagInclude },
        receipts: { select: { id: true } },
        account: {
          select: {
            name: true,
            bankConnection: { select: { institutionName: true } },
          },
        },
      },
    });

    const splits = await this.prisma.transactionSplit.findMany({
      where: {
        amount,
        ...(categoryId ? { categoryId } : {}),
        ...(query.payeeLabel ? { payeeLabel: query.payeeLabel } : {}),
        ...tagFilter,
        transaction: {
          isSplit: true,
          bookedAt: { gte: periodStart, lte: periodEnd },
          account: accountWhere,
        },
      },
      include: {
        category: true,
        tags: { include: tagInclude },
        transaction: {
          include: {
            receipts: { select: { id: true } },
            splits: { select: { amount: true } },
            account: {
              select: {
                name: true,
                bankConnection: { select: { institutionName: true } },
              },
            },
          },
        },
      },
    });

    const items: SpendingTransaction[] = [
      ...unsplit.map((tx) => this.mapUnsplit(tx, rates)),
      ...splits.map((split) => this.mapSplit(split, rates)),
    ].sort((a, b) => {
      const byDate = b.bookedAt.localeCompare(a.bookedAt);
      if (byDate !== 0) return byDate;
      return b.id.localeCompare(a.id);
    });

    const cursor = query.cursor
      ? (JSON.parse(
          Buffer.from(query.cursor, "base64url").toString("utf8"),
        ) as { bookedAt: string; id: string })
      : null;

    const afterCursor = cursor
      ? items.filter((item) => {
          if (item.bookedAt < cursor.bookedAt) return true;
          if (item.bookedAt === cursor.bookedAt && item.id < cursor.id) return true;
          return false;
        })
      : items;

    const page = afterCursor.slice(0, query.limit);
    const last = page.at(-1);
    const hasMore = afterCursor.length > query.limit;

    const transferInfo = await this.transfersService.loadTransferInfoByTransactionIds(
      userId,
      page.map((item) => item.transactionId),
    );

    return {
      transactions: page.map((item) => ({
        ...item,
        transfer: transferInfo.get(item.transactionId) ?? null,
      })),
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ bookedAt: last.bookedAt, id: last.id }),
            ).toString("base64url")
          : null,
    };
  }

  async getTransactionDetail(
    userId: string,
    transactionId: string,
  ): Promise<TransactionDetail> {
    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, account: { userId } },
      include: {
        category: true,
        tags: { include: tagInclude },
        receipts: { orderBy: { createdAt: "asc" } },
        splits: {
          include: {
            category: true,
            tags: { include: tagInclude },
          },
          orderBy: { createdAt: "asc" },
        },
        account: {
          include: { bankConnection: { select: { institutionName: true } } },
        },
      },
    });
    if (!tx) throw new NotFoundException("Transaction not found");

    const rates = await this.fx.getRates();
    const base = this.mapUnsplit(tx, rates);
    const transferInfo = await this.transfersService.loadTransferInfoByTransactionIds(
      userId,
      [tx.id],
    );
    return {
      ...base,
      transfer: transferInfo.get(tx.id) ?? null,
      receipts: tx.receipts.map((receipt) => ({
        id: receipt.id,
        originalName: receipt.originalName,
        storedName: receipt.storedName,
        mimeType: receipt.mimeType,
        sizeBytes: receipt.sizeBytes,
      })),
      splits: tx.splits.map((split) => ({
        id: split.id,
        amount: toNumber(split.amount),
        amountEur: this.fx.toEur(
          toNumber(split.amount),
          tx.currency,
          rates,
        ),
        categoryId: split.categoryId,
        categoryName: split.category.name,
        payeeLabel: split.payeeLabel,
        description: split.description,
        tags: split.tags.map((row) => mapTag(row.tag)),
      })),
    };
  }

  async replaceSplits(
    userId: string,
    transactionId: string,
    input: ReplaceSplitsInput,
  ) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, account: { userId } },
    });
    if (!transaction) throw new NotFoundException("Transaction not found");

    const parentAmount = toNumber(transaction.amount);
    const signedSplits = input.splits.map((line) => {
      const signed =
        parentAmount < 0 ? -Math.abs(line.amount) : Math.abs(line.amount);
      return { ...line, amount: signed };
    });

    if (splitsOutOfBalance(parentAmount, signedSplits.map((line) => line.amount))) {
      throw new BadRequestException(
        "Split amounts must add up to the original transaction amount",
      );
    }

    await this.prisma.$transaction(async (db) => {
      await db.transactionSplit.deleteMany({ where: { transactionId } });
      await db.transactionTag.deleteMany({ where: { transactionId } });
      await db.transaction.update({
        where: { id: transactionId },
        data: { isSplit: true, categoryId: null, categoryLocked: true },
      });

      for (const line of signedSplits) {
        const split = await db.transactionSplit.create({
          data: {
            transactionId,
            categoryId: line.categoryId,
            amount: line.amount,
            payeeLabel: line.payeeLabel,
            description: line.description,
          },
        });
        if (line.tagIds.length > 0) {
          await db.transactionSplitTag.createMany({
            data: line.tagIds.map((tagId) => ({ splitId: split.id, tagId })),
            skipDuplicates: true,
          });
        }
      }
    });

    await this.categoriesService.invalidateSpendingCache(userId);
    return this.getTransactionDetail(userId, transactionId);
  }

  async unsplitTransaction(
    userId: string,
    transactionId: string,
    input: UnsplitTransactionInput,
  ) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, account: { userId } },
    });
    if (!transaction) throw new NotFoundException("Transaction not found");

    await this.prisma.$transaction(async (db) => {
      await db.transactionSplit.deleteMany({ where: { transactionId } });
      await db.transaction.update({
        where: { id: transactionId },
        data: {
          isSplit: false,
          categoryId: input.categoryId,
          payeeLabel: input.payeeLabel,
          categoryLocked: true,
        },
      });
      await db.transactionTag.deleteMany({ where: { transactionId } });
      if (input.tagIds.length > 0) {
        await db.transactionTag.createMany({
          data: input.tagIds.map((tagId) => ({ transactionId, tagId })),
          skipDuplicates: true,
        });
      }
    });

    await this.categoriesService.invalidateSpendingCache(userId);
    return this.getTransactionDetail(userId, transactionId);
  }

  async updateSplit(userId: string, splitId: string, input: UpdateSplitInput) {
    const split = await this.prisma.transactionSplit.findFirst({
      where: { id: splitId, transaction: { account: { userId } } },
    });
    if (!split) throw new NotFoundException("Split not found");

    await this.prisma.transactionSplit.update({
      where: { id: splitId },
      data: {
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.payeeLabel ? { payeeLabel: input.payeeLabel } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });

    if (input.tagIds) {
      await this.categoriesService.replaceSplitTags(splitId, input.tagIds);
    }

    await this.categoriesService.invalidateSpendingCache(userId);
    return this.getTransactionDetail(userId, split.transactionId);
  }

  private async computeAndCacheSummary(
    userId: string,
    period: ResolvedSpendingPeriod,
    bankConnectionId: string | null,
    tagIds: string[] | undefined,
    flow: CashFlow,
  ): Promise<SpendingSummaryResponse> {
    const { periodStart, periodEnd } = period;
    const persistCache = flow === "out" && !tagIds?.length;

    if (persistCache) {
      await this.prisma.categoryPeriodStat.deleteMany({
        where: {
          userId,
          rangeType: period.cacheKey,
          periodStart: toDateOnly(periodStart),
          periodEnd: toDateOnly(periodEnd),
          bankConnectionId,
        },
      });
    }

    const allGrouped = await this.groupCategoryTotals(
      userId,
      bankConnectionId,
      tagIds,
      periodStart,
      periodEnd,
      flow,
    );

    if (persistCache) {
      for (const row of allGrouped) {
        await this.prisma.categoryPeriodStat.create({
          data: {
            userId,
            categoryId: row.category.id,
            bankConnectionId,
            rangeType: period.cacheKey,
            periodStart: toDateOnly(periodStart),
            periodEnd: toDateOnly(periodEnd),
            totalSpent: row.totalSpent,
            transactionCount: row.transactionCount,
            payees: {
              create: row.payees.map((payee) => ({
                payeeLabel: payee.payeeLabel,
                totalSpent: payee.totalSpent,
                transactionCount: payee.transactionCount,
              })),
            },
          },
        });
      }
    }

    return this.buildSummaryFromRows(
      period,
      allGrouped.map((row) => ({
        category: row.category,
        totalSpent: row.totalSpent,
        transactionCount: row.transactionCount,
      })),
      false,
      flow,
    );
  }

  private async groupCategoryTotals(
    userId: string,
    bankConnectionId: string | null,
    tagIds: string[] | undefined,
    periodStart: Date,
    periodEnd: Date,
    flow: CashFlow,
  ) {
    const accountFilter: Prisma.AccountWhereInput = {
      userId,
      ...(bankConnectionId ? { bankConnectionId } : {}),
    };
    const tagFilter = this.tagAndFilter(tagIds);
    const amount = amountFilter(flow);

    const rates = await this.fx.getRates();
    const unsplit = await this.prisma.transaction.findMany({
      where: {
        isSplit: false,
        amount,
        bookedAt: { gte: periodStart, lte: periodEnd },
        account: accountFilter,
        categoryId: { not: null },
        ...tagFilter,
      },
      select: { categoryId: true, amount: true, currency: true, payeeLabel: true },
    });

    const splits = await this.prisma.transactionSplit.findMany({
      where: {
        amount,
        ...tagFilter,
        transaction: {
          isSplit: true,
          bookedAt: { gte: periodStart, lte: periodEnd },
          account: accountFilter,
        },
      },
      select: {
        categoryId: true,
        amount: true,
        payeeLabel: true,
        transaction: { select: { currency: true } },
      },
    });

    const categories = await this.prisma.category.findMany({
      where: { userId, deletedAt: null },
    });
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const grouped = new Map<
      string,
      {
        totalSpent: number;
        transactionCount: number;
        payees: Map<string, { totalSpent: number; transactionCount: number }>;
      }
    >();

    const rows = [
      ...unsplit.map((row) => ({
        categoryId: row.categoryId,
        amount: row.amount,
        currency: row.currency,
        payeeLabel: row.payeeLabel,
      })),
      ...splits.map((row) => ({
        categoryId: row.categoryId,
        amount: row.amount,
        currency: row.transaction.currency,
        payeeLabel: row.payeeLabel,
      })),
    ];

    for (const row of rows) {
      if (!row.categoryId) continue;
      const current = grouped.get(row.categoryId) ?? {
        totalSpent: 0,
        transactionCount: 0,
        payees: new Map(),
      };
      const spent = Math.abs(this.fx.toEur(toNumber(row.amount), row.currency, rates));
      current.totalSpent += spent;
      current.transactionCount += 1;
      const payeeKey = row.payeeLabel ?? "Unknown";
      const payee = current.payees.get(payeeKey) ?? {
        totalSpent: 0,
        transactionCount: 0,
      };
      payee.totalSpent += spent;
      payee.transactionCount += 1;
      current.payees.set(payeeKey, payee);
      grouped.set(row.categoryId, current);
    }

    return [...grouped.entries()]
      .map(([id, stats]) => {
        const category = categoryMap.get(id);
        if (!category) return null;
        return {
          category,
          totalSpent: roundMoney(stats.totalSpent),
          transactionCount: stats.transactionCount,
          payees: [...stats.payees.entries()].map(([payeeLabel, payee]) => ({
            payeeLabel,
            totalSpent: roundMoney(payee.totalSpent),
            transactionCount: payee.transactionCount,
          })),
        };
      })
      .filter(Boolean) as Array<{
      category: (typeof categories)[number];
      totalSpent: number;
      transactionCount: number;
      payees: Array<{
        payeeLabel: string;
        totalSpent: number;
        transactionCount: number;
      }>;
    }>;
  }

  private buildSummaryFromRows(
    period: ResolvedSpendingPeriod,
    rows: Array<{
      category: {
        id: string;
        name: string;
        color: string;
        icon: string | null;
        isSystem: boolean;
        kind: import("@poca/db").CategoryKind;
      };
      totalSpent: number;
      transactionCount: number;
    }>,
    cached: boolean,
    flow: CashFlow,
  ): SpendingSummaryResponse {
    const transferRows = rows.filter((row) => row.category.kind === "TRANSFER");
    const primaryRows =
      flow === "in"
        ? rows.filter((row) => isIncomeCategoryKind(row.category.kind))
        : rows.filter((row) => isSpendingCategoryKind(row.category.kind));
    const reviewRows =
      flow === "in"
        ? rows.filter((row) => isSpendingCategoryKind(row.category.kind))
        : [];

    const totalSpent = roundMoney(
      primaryRows.reduce((sum, row) => sum + row.totalSpent, 0),
    );
    const totalTransferred = roundMoney(
      transferRows.reduce((sum, row) => sum + row.totalSpent, 0),
    );
    const transactionCount = primaryRows.reduce(
      (sum, row) => sum + row.transactionCount,
      0,
    );
    const transferTransactionCount = transferRows.reduce(
      (sum, row) => sum + row.transactionCount,
      0,
    );

    const transferCategories = transferRows
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .map((row) => ({
        id: row.category.id,
        name: row.category.name,
        color: row.category.color,
        icon: row.category.icon,
        isSystem: row.category.isSystem,
        kind: row.category.kind,
        totalSpent: row.totalSpent,
        transactionCount: row.transactionCount,
        share:
          totalTransferred > 0
            ? roundMoney((row.totalSpent / totalTransferred) * 100)
            : 0,
      }));

    const transfersCategory =
      transferCategories.length === 1 ? transferCategories[0]! : null;

    const reviewTotal = reviewRows.reduce((sum, row) => sum + row.totalSpent, 0);

    return {
      range: period.kind,
      periodLabel: period.label,
      periodStart: period.periodStart.toISOString(),
      periodEnd: period.periodEnd.toISOString(),
      flow,
      totalSpent,
      totalTransferred,
      transferTransactionCount,
      transactionCount,
      cached,
      transfersCategory,
      transferCategories,
      reviewCategories: reviewRows
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .map((row) => ({
          id: row.category.id,
          name: row.category.name,
          color: row.category.color,
          icon: row.category.icon,
          isSystem: row.category.isSystem,
          kind: row.category.kind,
          totalSpent: row.totalSpent,
          transactionCount: row.transactionCount,
          share:
            reviewTotal > 0
              ? roundMoney((row.totalSpent / reviewTotal) * 100)
              : 0,
        })),
      categories: primaryRows
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .map((row) => ({
          id: row.category.id,
          name: row.category.name,
          color: row.category.color,
          icon: row.category.icon,
          isSystem: row.category.isSystem,
          kind: row.category.kind,
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
    tagIds: string[] | undefined,
    flow: CashFlow = "out",
  ) {
    const accountFilter: Prisma.AccountWhereInput = {
      userId,
      ...(bankConnectionId ? { bankConnectionId } : {}),
    };
    const tagFilter = this.tagAndFilter(tagIds);
    const amount = amountFilter(flow);

    const rates = await this.fx.getRates();
    const unsplit = await this.prisma.transaction.findMany({
      where: {
        isSplit: false,
        categoryId,
        amount,
        bookedAt: { gte: periodStart, lte: periodEnd },
        account: accountFilter,
        ...tagFilter,
      },
      select: { payeeLabel: true, amount: true, currency: true },
    });
    const splits = await this.prisma.transactionSplit.findMany({
      where: {
        categoryId,
        amount,
        ...tagFilter,
        transaction: {
          isSplit: true,
          bookedAt: { gte: periodStart, lte: periodEnd },
          account: accountFilter,
        },
      },
      select: {
        payeeLabel: true,
        amount: true,
        transaction: { select: { currency: true } },
      },
    });

    const payees = new Map<string, { totalSpent: number; transactionCount: number }>();
    const rows = [
      ...unsplit.map((row) => ({
        payeeLabel: row.payeeLabel,
        amount: row.amount,
        currency: row.currency,
      })),
      ...splits.map((row) => ({
        payeeLabel: row.payeeLabel,
        amount: row.amount,
        currency: row.transaction.currency,
      })),
    ];
    for (const row of rows) {
      const key = row.payeeLabel ?? "Unknown";
      const current = payees.get(key) ?? { totalSpent: 0, transactionCount: 0 };
      current.totalSpent += Math.abs(
        this.fx.toEur(toNumber(row.amount), row.currency, rates),
      );
      current.transactionCount += 1;
      payees.set(key, current);
    }

    return [...payees.entries()]
      .map(([payeeLabel, stats]) => ({
        payeeLabel,
        totalSpent: roundMoney(stats.totalSpent),
        transactionCount: stats.transactionCount,
        share: 0,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }

  private tagAndFilter(tagIds?: string[]) {
    if (!tagIds?.length) return {};
    return {
      AND: tagIds.map((tagId) => ({
        tags: { some: { tagId } },
      })),
    };
  }

  private mapUnsplit(tx: {
    id: string;
    amount: { toString(): string };
    currency: string;
    description: string;
    merchant: string | null;
    payeeLabel: string | null;
    bookedAt: Date;
    categoryId: string | null;
    externalId: string | null;
    isSplit: boolean;
    category: { name: string; kind?: import("@poca/db").CategoryKind } | null;
    tags: Array<{ tag: { id: string; name: string; color: string; icon: string | null } }>;
    receipts: Array<{ id: string }>;
    splits?: Array<{ amount: { toString(): string } }>;
    account: {
      name: string;
      bankConnection: { institutionName: string } | null;
    };
  },
  rates: Record<string, number>,
  ): SpendingTransaction {
    const splitAmounts = (tx.splits ?? []).map((split) => toNumber(split.amount));
    const amount = toNumber(tx.amount);
    return {
      kind: "transaction",
      id: tx.id,
      transactionId: tx.id,
      splitId: null,
      amount,
      amountEur: this.fx.toEur(amount, tx.currency, rates),
      currency: tx.currency,
      description: tx.description,
      merchant: tx.merchant,
      payeeLabel: tx.payeeLabel,
      bookedAt: tx.bookedAt.toISOString(),
      categoryId: tx.categoryId,
      categoryName: tx.category?.name ?? null,
      categoryKind: tx.category?.kind ?? null,
      institutionName: tx.account.bankConnection?.institutionName ?? "",
      accountName: tx.account.name,
      externalId: tx.externalId,
      isSplit: tx.isSplit,
      splitOutOfBalance:
        tx.isSplit && splitsOutOfBalance(toNumber(tx.amount), splitAmounts),
      tags: tx.tags.map((row) => mapTag(row.tag)),
      receiptCount: tx.receipts.length,
      transfer: null,
    };
  }

  private mapSplit(split: {
    id: string;
    amount: { toString(): string };
    payeeLabel: string;
    description: string | null;
    categoryId: string;
    category: { name: string; kind?: import("@poca/db").CategoryKind };
    tags: Array<{ tag: { id: string; name: string; color: string; icon: string | null } }>;
    transaction: {
      id: string;
      currency: string;
      description: string;
      merchant: string | null;
      payeeLabel: string | null;
      bookedAt: Date;
      externalId: string | null;
      isSplit: boolean;
      amount: { toString(): string };
      receipts: Array<{ id: string }>;
      splits: Array<{ amount: { toString(): string } }>;
      account: {
        name: string;
        bankConnection: { institutionName: string } | null;
      };
    };
  },
  rates: Record<string, number>,
  ): SpendingTransaction {
    const splitAmounts = split.transaction.splits.map((item) => toNumber(item.amount));
    const amount = toNumber(split.amount);
    return {
      kind: "split",
      id: split.id,
      transactionId: split.transaction.id,
      splitId: split.id,
      amount,
      amountEur: this.fx.toEur(amount, split.transaction.currency, rates),
      currency: split.transaction.currency,
      description: split.description ?? split.transaction.description,
      merchant: split.transaction.merchant,
      payeeLabel: split.payeeLabel,
      bookedAt: split.transaction.bookedAt.toISOString(),
      categoryId: split.categoryId,
      categoryName: split.category.name,
      categoryKind: split.category.kind ?? null,
      institutionName:
        split.transaction.account.bankConnection?.institutionName ?? "",
      accountName: split.transaction.account.name,
      externalId: split.transaction.externalId,
      isSplit: true,
      splitOutOfBalance: splitsOutOfBalance(
        toNumber(split.transaction.amount),
        splitAmounts,
      ),
      tags: split.tags.map((row) => mapTag(row.tag)),
      receiptCount: split.transaction.receipts.length,
      transfer: null,
    };
  }
}
