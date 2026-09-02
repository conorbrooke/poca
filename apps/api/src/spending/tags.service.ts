import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  SpendingQuery,
  SpendingTransactionsQuery,
  TagSummaryResponse,
} from "@poca/shared";
import { isSpendingCategoryKind } from "@poca/shared";
import { Prisma } from "@poca/db";
import { PrismaService } from "../prisma/prisma.module";
import { mapTag, toNumber } from "./mappers";
import { resolveSpendingPeriod, roundMoney } from "./period";
import { SpendingService } from "./spending.service";

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spendingService: SpendingService,
  ) {}

  async listTags(userId: string) {
    return this.prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
  }

  async createTag(
    userId: string,
    input: { name: string; color?: string; icon?: string },
  ) {
    const name = input.name.trim();
    const existing = await this.prisma.tag.findUnique({
      where: { userId_name: { userId, name } },
    });
    if (existing) return existing;

    return this.prisma.tag.create({
      data: {
        userId,
        name,
        color: input.color ?? "#6366f1",
        icon: input.icon,
      },
    });
  }

  async updateTag(
    userId: string,
    tagId: string,
    input: { name?: string; color?: string; icon?: string | null },
  ) {
    const tag = await this.requireTag(userId, tagId);
    return this.prisma.tag.update({
      where: { id: tag.id },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.color ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
      },
    });
  }

  async deleteTag(userId: string, tagId: string) {
    await this.requireTag(userId, tagId);
    await this.prisma.tag.delete({ where: { id: tagId } });
    return { deleted: true };
  }

  async getSummary(
    userId: string,
    tagId: string,
    query: SpendingQuery,
  ): Promise<TagSummaryResponse> {
    const tag = await this.requireTag(userId, tagId);
    const { periodStart, periodEnd } = resolveSpendingPeriod(query.range);
    const accountFilter: Prisma.AccountWhereInput = {
      userId,
      ...(query.bankConnectionId ? { bankConnectionId: query.bankConnectionId } : {}),
    };

    const unsplit = await this.prisma.transaction.findMany({
      where: {
        isSplit: false,
        amount: { lt: 0 },
        bookedAt: { gte: periodStart, lte: periodEnd },
        account: accountFilter,
        tags: { some: { tagId } },
      },
      select: { categoryId: true, amount: true },
    });

    const splits = await this.prisma.transactionSplit.findMany({
      where: {
        amount: { lt: 0 },
        tags: { some: { tagId } },
        transaction: {
          isSplit: true,
          bookedAt: { gte: periodStart, lte: periodEnd },
          account: accountFilter,
        },
      },
      select: { categoryId: true, amount: true },
    });

    const categories = await this.prisma.category.findMany({ where: { userId } });
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const totals = new Map<string, { totalSpent: number; transactionCount: number }>();

    for (const row of [...unsplit, ...splits]) {
      if (!row.categoryId) continue;
      const category = categoryMap.get(row.categoryId);
      if (!category || !isSpendingCategoryKind(category.kind)) continue;
      const current = totals.get(row.categoryId) ?? {
        totalSpent: 0,
        transactionCount: 0,
      };
      current.totalSpent += Math.abs(toNumber(row.amount));
      current.transactionCount += 1;
      totals.set(row.categoryId, current);
    }

    const categoryRows = [...totals.entries()]
      .map(([id, stats]) => {
        const category = categoryMap.get(id);
        if (!category) return null;
        return {
          id: category.id,
          name: category.name,
          color: category.color,
          icon: category.icon,
          isSystem: category.isSystem,
          kind: category.kind,
          totalSpent: roundMoney(stats.totalSpent),
          transactionCount: stats.transactionCount,
          share: 0,
        };
      })
      .filter(Boolean) as TagSummaryResponse["categories"];

    categoryRows.sort((a, b) => b.totalSpent - a.totalSpent);
    const totalSpent = roundMoney(
      categoryRows.reduce((sum, row) => sum + row.totalSpent, 0),
    );
    const transactionCount = categoryRows.reduce(
      (sum, row) => sum + row.transactionCount,
      0,
    );

    return {
      tag: mapTag(tag),
      range: query.range,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalSpent,
      transactionCount,
      categories: categoryRows.map((row) => ({
        ...row,
        share:
          totalSpent > 0 ? roundMoney((row.totalSpent / totalSpent) * 100) : 0,
      })),
    };
  }

  async listTagTransactions(
    userId: string,
    tagId: string,
    query: SpendingTransactionsQuery,
  ) {
    await this.requireTag(userId, tagId);
    return this.spendingService.listAllocatableTransactions(userId, {
      ...query,
      tagIds: [tagId],
    });
  }

  private async requireTag(userId: string, tagId: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, userId },
    });
    if (!tag) throw new NotFoundException("Tag not found");
    return tag;
  }

  async assertTagIds(userId: string, tagIds: string[]) {
    if (tagIds.length === 0) return;
    const count = await this.prisma.tag.count({
      where: { userId, id: { in: tagIds } },
    });
    if (count !== tagIds.length) {
      throw new BadRequestException("One or more tags were not found");
    }
  }
}
