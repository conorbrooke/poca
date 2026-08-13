import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DEFAULT_CATEGORY_DEFINITIONS } from "@poca/shared";
import { PrismaService } from "../prisma/prisma.module";
import {
  buildFallbackPayee,
  extractRuleMatchText,
  loadSystemRules,
  matchTransaction,
} from "../categorize/categorizer";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaults(userId: string) {
    for (const definition of DEFAULT_CATEGORY_DEFINITIONS) {
      await this.prisma.category.upsert({
        where: {
          userId_name: {
            userId,
            name: definition.name,
          },
        },
        create: {
          userId,
          name: definition.name,
          color: definition.color,
          icon: definition.icon,
          isSystem: "isSystem" in definition ? definition.isSystem : false,
        },
        update: {},
      });
    }

    await this.ensureSystemRules(userId);
  }

  async ensureSystemRules(userId: string) {
    const categories = await this.prisma.category.findMany({
      where: { userId },
    });
    const categoryByName = new Map(categories.map((c) => [c.name, c.id]));
    const existing = await this.prisma.categoryRule.findMany({
      where: { userId, source: "system" },
      select: { matchText: true },
    });
    const existingMatches = new Set(existing.map((rule) => rule.matchText));

    for (const rule of loadSystemRules()) {
      const categoryId = categoryByName.get(rule.category);
      if (!categoryId || existingMatches.has(rule.matchText)) continue;

      await this.prisma.categoryRule.create({
        data: {
          userId,
          categoryId,
          matchText: rule.matchText,
          payeeLabel: rule.payeeLabel,
          priority: rule.priority,
          source: "system",
        },
      });
    }
  }

  async listCategories(userId: string) {
    await this.ensureDefaults(userId);
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: [{ isSystem: "asc" }, { name: "asc" }],
    });
  }

  async createCategory(
    userId: string,
    input: { name: string; color?: string; icon?: string },
  ) {
    const name = input.name.trim();

    return this.prisma.category.upsert({
      where: {
        userId_name: {
          userId,
          name,
        },
      },
      create: {
        userId,
        name,
        color: input.color ?? "#6366f1",
        icon: input.icon,
      },
      update: {
        ...(input.color ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
      },
    });
  }

  async updateCategory(
    userId: string,
    categoryId: string,
    input: { name?: string; color?: string; icon?: string | null },
  ) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) throw new NotFoundException("Category not found");

    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.color ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
      },
    });
  }

  async getOtherCategoryId(userId: string): Promise<string> {
    await this.ensureDefaults(userId);
    const other = await this.prisma.category.findFirstOrThrow({
      where: { userId, name: "Other" },
    });
    return other.id;
  }

  async categorizeTransactions(
    userId: string,
    transactionIds?: string[],
  ): Promise<number> {
    await this.ensureDefaults(userId);
    const otherCategoryId = await this.getOtherCategoryId(userId);

    const userRules = await this.prisma.categoryRule.findMany({
      where: { userId },
      include: { category: true, tags: true },
      orderBy: { priority: "desc" },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: {
        isSplit: false,
        account: { userId },
        ...(transactionIds ? { id: { in: transactionIds } } : {}),
      },
      select: {
        id: true,
        description: true,
        merchant: true,
      },
    });

    const categories = await this.prisma.category.findMany({ where: { userId } });
    const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

    let updated = 0;
    for (const tx of transactions) {
      const match = matchTransaction(tx.description, tx.merchant, userRules);
      const categoryId = match
        ? (categoryIdByName.get(match.categoryName) ?? otherCategoryId)
        : otherCategoryId;
      const payeeLabel =
        match?.payeeLabel ?? buildFallbackPayee(tx.description, tx.merchant);

      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: { categoryId, payeeLabel },
      });

      if (match?.source === "user") {
        await this.replaceTransactionTags(tx.id, match.tagIds);
      }

      updated++;
    }

    await this.invalidateSpendingCache(userId);
    return updated;
  }

  async recategorizeTransaction(
    userId: string,
    transactionId: string,
    input: {
      categoryId?: string;
      payeeLabel: string;
      createRule: boolean;
      applyToSimilar: boolean;
      tagIds?: string[];
    },
  ) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, account: { userId } },
    });

    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }

    if (transaction.isSplit && (input.categoryId || input.tagIds)) {
      throw new BadRequestException(
        "Split transactions can only be categorized on their sub-transactions",
      );
    }

    const categoryId = input.categoryId ?? transaction.categoryId;
    if (!categoryId && !transaction.isSplit) {
      throw new NotFoundException("Transaction has no category");
    }

    const matchText = extractRuleMatchText(
      transaction.description,
      transaction.merchant,
    );

    if (input.createRule && categoryId) {
      await this.upsertUserRule(userId, {
        categoryId,
        matchText,
        payeeLabel: input.payeeLabel,
        tagIds: input.tagIds,
      });
    }

    const idsToUpdate = [transaction.id];

    if (input.applyToSimilar) {
      const similar = await this.prisma.transaction.findMany({
        where: {
          account: { userId },
          isSplit: false,
          id: { not: transaction.id },
          OR: [
            {
              description: {
                contains: matchText,
                mode: "insensitive",
              },
            },
            transaction.merchant
              ? {
                  merchant: {
                    contains: matchText,
                    mode: "insensitive",
                  },
                }
              : undefined,
          ].filter(Boolean) as Array<Record<string, unknown>>,
        },
        select: { id: true },
      });
      idsToUpdate.push(...similar.map((item) => item.id));
    }

    await this.prisma.transaction.updateMany({
      where: { id: { in: idsToUpdate } },
      data: {
        payeeLabel: input.payeeLabel,
        ...(input.categoryId && !transaction.isSplit
          ? { categoryId: input.categoryId }
          : {}),
      },
    });

    if (input.tagIds && !transaction.isSplit) {
      for (const id of idsToUpdate) {
        await this.replaceTransactionTags(id, input.tagIds);
      }
    }

    await this.invalidateSpendingCache(userId);

    return { updatedCount: idsToUpdate.length, matchText };
  }

  async replaceTransactionTags(transactionId: string, tagIds: string[]) {
    await this.prisma.transactionTag.deleteMany({ where: { transactionId } });
    if (tagIds.length === 0) return;
    await this.prisma.transactionTag.createMany({
      data: tagIds.map((tagId) => ({ transactionId, tagId })),
      skipDuplicates: true,
    });
  }

  async replaceSplitTags(splitId: string, tagIds: string[]) {
    await this.prisma.transactionSplitTag.deleteMany({ where: { splitId } });
    if (tagIds.length === 0) return;
    await this.prisma.transactionSplitTag.createMany({
      data: tagIds.map((tagId) => ({ splitId, tagId })),
      skipDuplicates: true,
    });
  }

  async upsertUserRule(
    userId: string,
    input: {
      categoryId: string;
      matchText: string;
      payeeLabel: string;
      tagIds?: string[];
    },
  ) {
    const existingRule = await this.prisma.categoryRule.findFirst({
      where: { userId, matchText: input.matchText, source: "user" },
    });

    const rule = existingRule
      ? await this.prisma.categoryRule.update({
          where: { id: existingRule.id },
          data: {
            categoryId: input.categoryId,
            payeeLabel: input.payeeLabel,
            priority: 20_000,
          },
        })
      : await this.prisma.categoryRule.create({
          data: {
            userId,
            categoryId: input.categoryId,
            matchText: input.matchText,
            payeeLabel: input.payeeLabel,
            priority: 20_000,
            source: "user",
          },
        });

    if (input.tagIds) {
      await this.prisma.categoryRuleTag.deleteMany({ where: { ruleId: rule.id } });
      if (input.tagIds.length > 0) {
        await this.prisma.categoryRuleTag.createMany({
          data: input.tagIds.map((tagId) => ({ ruleId: rule.id, tagId })),
          skipDuplicates: true,
        });
      }
    }

    return rule;
  }

  async invalidateSpendingCache(userId: string) {
    await this.prisma.categoryPeriodStat.deleteMany({ where: { userId } });
  }

  async ensureDemoUserId() {
    const user = await this.prisma.user.upsert({
      where: { email: "demo@poca.local" },
      create: { email: "demo@poca.local", name: "Demo User" },
      update: {},
    });
    return user.id;
  }
}
