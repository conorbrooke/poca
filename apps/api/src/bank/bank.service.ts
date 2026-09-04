import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EnableBankingProvider } from "@poca/bank-connect";
import { EnableBankingApiError } from "@poca/bank-connect";
import {
  pickAccountBalance,
  toStoredAccount,
} from "@poca/bank-connect";
import type { BankConnectProvider, ExternalTransaction } from "@poca/bank-connect";
import { BankConnectionStatus, BankProvider, SyncJobStatus } from "@poca/db";
import type {
  CompleteBankLinkInput,
  ConnectionStats,
  CreateBankLinkInput,
  SyncTransactionsInput,
  TransactionsQuery,
} from "@poca/shared";
import { sumBalancesByCurrency, normalizeIban } from "@poca/shared";
import { Prisma } from "@poca/db";
import { PrismaService } from "../prisma/prisma.module";
import { CategoriesService } from "../spending/categories.service";
import { TransfersService } from "../spending/transfers.service";
import { FxService } from "../fx/fx.service";
import {
  computeStats,
  connectionStatsFromRow,
  connectionStatsToDb,
  mergeStats,
  syncDateFrom,
} from "./stats";

type TransactionCursor = {
  bookedAt: string;
  id: string;
};

function toNumber(value: { toString(): string }): number {
  return parseFloat(value.toString());
}

function compareDashboardAccounts(
  left: { currency: string; accountType: string | null; name: string },
  right: { currency: string; accountType: string | null; name: string },
): number {
  const leftHome = left.currency === "EUR" ? 0 : 1;
  const rightHome = right.currency === "EUR" ? 0 : 1;
  if (leftHome !== rightHome) return leftHome - rightHome;
  const typeRank = (type: string | null) =>
    type === "CACC" ? 0 : type === "SVGS" ? 1 : 2;
  const typeDiff = typeRank(left.accountType) - typeRank(right.accountType);
  if (typeDiff !== 0) return typeDiff;
  return left.name.localeCompare(right.name);
}

function encodeCursor(bookedAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ bookedAt: bookedAt.toISOString(), id }),
  ).toString("base64url");
}

function decodeCursor(cursor: string): TransactionCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as TransactionCursor;
    if (!parsed.bookedAt || !parsed.id) {
      throw new Error("Invalid cursor");
    }
    return parsed;
  } catch {
    throw new BadRequestException("Invalid transaction cursor");
  }
}

const EMPTY_STATS: ConnectionStats = {
  totalIncome: 0,
  totalSpent: 0,
  netFlow: 0,
  transactionCount: 0,
  avgTransactionSize: 0,
  thisMonthIncome: 0,
  thisMonthSpent: 0,
};

@Injectable()
export class BankService {
  private provider: BankConnectProvider;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
    private readonly transfersService: TransfersService,
    private readonly fx: FxService,
  ) {
    const applicationId = this.config.get<string>(
      "ENABLE_BANKING_APPLICATION_ID",
    );
    const privateKeyPath = this.config.get<string>(
      "ENABLE_BANKING_PRIVATE_KEY_PATH",
    );
    const privateKey = this.config.get<string>("ENABLE_BANKING_PRIVATE_KEY");

    if (!applicationId || (!privateKeyPath && !privateKey)) {
      throw new Error("Enable Banking credentials not configured");
    }

    this.provider = EnableBankingProvider.fromEnv({
      applicationId,
      privateKeyPath,
      privateKey,
      apiOrigin: this.config.get<string>("ENABLE_BANKING_API_ORIGIN"),
    });
  }

  async listInstitutions(country: string) {
    return this.provider.listInstitutions(country);
  }

  async createLink(input: CreateBankLinkInput) {
    const { institutionId, redirectUrl, referenceId } = input;

    const institutions = await this.provider.listInstitutions("IE");
    const institution = institutions.find((i) => i.id === institutionId);
    if (!institution) {
      throw new BadRequestException("Unknown institution");
    }

    // TODO: Remove this once auth is implemented
    const user = await this.ensureDemoUser();
    const link = await this.createAuthLink(
      institutionId,
      redirectUrl,
      referenceId,
    );

    const connection = await this.prisma.bankConnection.create({
      data: {
        userId: user.id,
        provider: BankProvider.ENABLE_BANKING,
        institutionId,
        institutionName: institution.name,
        requisitionId: link.requisitionId,
        status: BankConnectionStatus.PENDING,
      },
    });

    return {
      connectionId: connection.id,
      state: link.referenceId,
      link: link.link,
    };
  }

  async completeLink(input: CompleteBankLinkInput) {
    const { code, state } = input;

    const connection = await this.prisma.bankConnection.findFirst({
      where: { requisitionId: state },
    });

    if (!connection) {
      throw new NotFoundException("Bank connection not found for this state");
    }

    if (!this.provider.completeBankLink) {
      throw new BadRequestException(
        "Current bank provider does not support OAuth callback",
      );
    }

    const session = await this.provider.completeBankLink(code);

    await this.prisma.bankConnection.update({
      where: { id: connection.id },
      data: {
        requisitionId: session.id,
        status: BankConnectionStatus.LINKED,
        consentExpiresAt: null,
        lastError: null,
      },
    });

    return {
      connectionId: connection.id,
      institutionId: connection.institutionId,
      institutionName: connection.institutionName,
      sessionId: session.id,
      accountCount: session.accountIds.length,
      status: BankConnectionStatus.LINKED,
    };
  }

  async listConnections() {
    const user = await this.ensureDemoUser();
    const connections = await this.prisma.bankConnection.findMany({
      where: { userId: user.id },
      include: {
        accounts: {
          include: {
            _count: { select: { transactions: true } },
          },
        },
      },
      orderBy: { institutionName: "asc" },
    });

    return connections.map((connection) => ({
      id: connection.id,
      institutionId: connection.institutionId,
      institutionName: connection.institutionName,
      status: connection.status,
      lastSyncedAt: connection.lastSyncedAt,
      lastError: connection.lastError,
      createdAt: connection.createdAt,
      accounts: connection.accounts
        .map((account) => ({
          id: account.id,
          name: account.name,
          iban: account.iban,
          currentBalance: toNumber(account.currentBalance),
          currency: account.currency,
          accountType: account.accountType,
          product: account.product,
          transactionCount: account._count.transactions,
        }))
        .sort(compareDashboardAccounts),
    }));
  }

  async getDashboard(bankConnectionId?: string) {
    const user = await this.ensureDemoUser();

    const connections = await this.prisma.bankConnection.findMany({
      where: {
        userId: user.id,
        ...(bankConnectionId ? { id: bankConnectionId } : {}),
      },
      include: {
        accounts: {
          include: {
            _count: { select: { transactions: true } },
          },
        },
        stats: true,
      },
      orderBy: { institutionName: "asc" },
    });

    const allConnections = await this.prisma.bankConnection.findMany({
      where: { userId: user.id },
      select: { id: true, institutionName: true, status: true },
      orderBy: { institutionName: "asc" },
    });

    const dashboardBanks = [];
    const statsList: ConnectionStats[] = [];
    const overallAccounts: Array<{ currentBalance: number; currency: string }> = [];

    for (const connection of connections) {
      const stats = await this.ensureConnectionStats(connection);
      const accounts = connection.accounts
        .map((account) => ({
          id: account.id,
          name: account.name,
          iban: account.iban,
          currentBalance: toNumber(account.currentBalance),
          currency: account.currency,
          accountType: account.accountType,
          product: account.product,
          transactionCount: account._count.transactions,
        }))
        .sort(compareDashboardAccounts);
      const balancesByCurrency = sumBalancesByCurrency(accounts);
      overallAccounts.push(...accounts);
      statsList.push(stats);

      dashboardBanks.push({
        id: connection.id,
        institutionId: connection.institutionId,
        institutionName: connection.institutionName,
        status: connection.status,
        lastSyncedAt: connection.lastSyncedAt,
        lastError: connection.lastError,
        balancesByCurrency,
        accounts,
        stats,
      });
    }

    if (!bankConnectionId) {
      const keptAccounts = await this.prisma.account.findMany({
        where: { userId: user.id, bankConnectionId: null, isActive: true },
        include: { _count: { select: { transactions: true } } },
      });
      overallAccounts.push(
        ...keptAccounts.map((account) => ({
          currentBalance: toNumber(account.currentBalance),
          currency: account.currency,
        })),
      );
    }

    return {
      connections: allConnections,
      banks: dashboardBanks,
      stats: {
        ...mergeStats(statsList),
        balancesByCurrency: sumBalancesByCurrency(overallAccounts),
      },
    };
  }

  async listTransactions(query: TransactionsQuery) {
    const user = await this.ensureDemoUser();
    const { bankConnectionId, limit, cursor } = query;

    const accountWhere: Prisma.AccountWhereInput = {
      userId: user.id,
      ...(bankConnectionId ? { bankConnectionId } : {}),
    };

    const cursorFilter = cursor
      ? this.buildCursorFilter(decodeCursor(cursor))
      : undefined;

    const rows = await this.prisma.transaction.findMany({
      where: {
        account: accountWhere,
        ...cursorFilter,
      },
      take: limit + 1,
      orderBy: [{ bookedAt: "desc" }, { id: "desc" }],
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true, kind: true },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        splits: {
          include: {
            category: { select: { name: true, color: true, icon: true } },
            tags: {
              include: {
                tag: { select: { id: true, name: true, color: true } },
              },
            },
          },
        },
        account: {
          include: {
            bankConnection: {
              select: { id: true, institutionName: true },
            },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    const transferInfo = await this.transfersService.loadTransferInfoByTransactionIds(
      user.id,
      page.map((tx) => tx.id),
    );
    const rates = await this.fx.getRates();

    return {
      transactions: page.map((tx) => {
        const amount = toNumber(tx.amount);
        return {
        id: tx.id,
        amount,
        amountEur: this.fx.toEur(amount, tx.currency, rates),
        currency: tx.currency,
        description: tx.description,
        payeeLabel: tx.payeeLabel,
        merchant: tx.merchant,
        bookedAt: tx.bookedAt.toISOString(),
        accountId: tx.accountId,
        accountName: tx.account.name,
        accountIban: tx.account.iban,
        bankConnectionId: tx.account.bankConnection?.id ?? "",
        institutionName:
          tx.account.bankConnection?.institutionName ??
          tx.account.institutionName ??
          "",
        isSplit: tx.isSplit,
        category: tx.category
          ? {
              id: tx.category.id,
              name: tx.category.name,
              color: tx.category.color,
              icon: tx.category.icon,
              kind: tx.category.kind,
            }
          : null,
        tags: tx.tags.map((row) => ({
          id: row.tag.id,
          name: row.tag.name,
          color: row.tag.color,
        })),
        splitCategories: tx.isSplit
          ? tx.splits.map((split) => ({
              name: split.category.name,
              color: split.category.color,
              icon: split.category.icon,
            }))
          : [],
        splitTags: tx.isSplit
          ? tx.splits.flatMap((split) =>
              split.tags.map((row) => ({
                id: row.tag.id,
                name: row.tag.name,
                color: row.tag.color,
              })),
            )
          : [],
        transfer: transferInfo.get(tx.id) ?? null,
      };
      }),
      nextCursor:
        hasMore && last ? encodeCursor(last.bookedAt, last.id) : null,
    };
  }

  async deleteConnection(connectionId: string, wipe = false) {
    const user = await this.ensureDemoUser();
    const connection = await this.prisma.bankConnection.findFirst({
      where: { id: connectionId, userId: user.id },
    });
    if (!connection) {
      throw new NotFoundException("Bank connection not found");
    }

    if (wipe) {
      await this.prisma.$transaction(async (db) => {
        await db.account.deleteMany({ where: { bankConnectionId: connectionId } });
        await db.connectionStats.deleteMany({ where: { bankConnectionId: connectionId } });
        await db.bankConnection.delete({ where: { id: connectionId } });
      });
      return { deleted: true, wiped: true };
    }

    await this.prisma.$transaction(async (db) => {
      await db.account.updateMany({
        where: { bankConnectionId: connectionId },
        data: {
          bankConnectionId: null,
          institutionName: connection.institutionName,
        },
      });
      await db.connectionStats.deleteMany({ where: { bankConnectionId: connectionId } });
      await db.bankConnection.delete({ where: { id: connectionId } });
    });

    return { deleted: true, wiped: false };
  }

  async resumeConnection(connectionId: string, redirectUrl: string) {
    const user = await this.ensureDemoUser();
    const connection = await this.prisma.bankConnection.findFirst({
      where: { id: connectionId, userId: user.id },
    });
    if (!connection) {
      throw new NotFoundException("Bank connection not found");
    }
    if (connection.status === BankConnectionStatus.LINKED) {
      throw new BadRequestException("This bank is already connected");
    }

    const link = await this.createAuthLink(
      connection.institutionId,
      redirectUrl,
    );

    await this.prisma.bankConnection.update({
      where: { id: connectionId },
      data: {
        requisitionId: link.requisitionId,
        status: BankConnectionStatus.PENDING,
        lastError: null,
      },
    });

    return {
      connectionId: connection.id,
      state: link.referenceId,
      link: link.link,
    };
  }

  async reconnectConnection(connectionId: string, redirectUrl: string) {
    const user = await this.ensureDemoUser();
    const connection = await this.prisma.bankConnection.findFirst({
      where: { id: connectionId, userId: user.id },
    });
    if (!connection) {
      throw new NotFoundException("Bank connection not found");
    }

    const link = await this.createAuthLink(
      connection.institutionId,
      redirectUrl,
    );

    await this.prisma.bankConnection.update({
      where: { id: connectionId },
      data: {
        requisitionId: link.requisitionId,
        status: BankConnectionStatus.PENDING,
        lastError: null,
      },
    });

    return {
      connectionId: connection.id,
      state: link.referenceId,
      link: link.link,
    };
  }

  async getConnection(connectionId: string) {
    const connection = await this.prisma.bankConnection.findUnique({
      where: { id: connectionId },
      include: { accounts: true },
    });

    if (!connection) {
      throw new NotFoundException("Bank connection not found");
    }

    if (!connection.requisitionId) {
      return connection;
    }

    if (connection.status === BankConnectionStatus.PENDING) {
      return connection;
    }

    const requisition = await this.provider.getRequisition(
      connection.requisitionId,
    );

    const status = this.mapRequisitionStatus(requisition.status);

    if (status !== connection.status) {
      await this.prisma.bankConnection.update({
        where: { id: connectionId },
        data: { status },
      });
    }

    return {
      ...connection,
      status,
      requisition,
    };
  }

  async syncTransactions(input: SyncTransactionsInput) {
    const { bankConnectionId, daysBack } = input;
    const dateFrom = syncDateFrom(daysBack);
    const dateTo = new Date().toISOString();

    const connection = await this.prisma.bankConnection.findUnique({
      where: { id: bankConnectionId },
    });

    if (!connection?.requisitionId) {
      throw new NotFoundException("Bank connection not found");
    }

    if (connection.status === BankConnectionStatus.PENDING) {
      throw new BadRequestException(
        "Complete bank authorisation before syncing",
      );
    }

    const user = await this.ensureDemoUser();

    const syncJob = await this.prisma.syncJob.create({
      data: {
        userId: user.id,
        bankConnectionId,
        status: SyncJobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      const requisition = await this.provider.getRequisition(
        connection.requisitionId,
      );

      let syncedCount = 0;
      const syncedTransactionIds: string[] = [];

      for (const externalAccountId of requisition.accountIds) {
        const externalAccount =
          await this.provider.getAccount(externalAccountId);
        const balances = await this.provider.getBalances(externalAccountId);
        const stored = toStoredAccount(externalAccount);
        const currentBalance = pickAccountBalance(
          balances,
          stored.currency,
        ).amount;

        const account = await this.resolveSyncedAccount({
          userId: user.id,
          bankConnectionId,
          institutionName: connection.institutionName,
          externalAccountId,
          stored,
          currentBalance,
        });

        const transactions = await this.provider.getTransactions(
          externalAccountId,
          dateFrom,
          dateTo,
        );

        for (const tx of transactions) {
          const saved = await this.upsertSyncedTransaction(account.id, tx);
          syncedCount++;
          if (saved.isNew) {
            syncedTransactionIds.push(saved.id);
          }
        }
      }

      if (syncedTransactionIds.length > 0) {
        await this.categoriesService.categorizeTransactions(
          user.id,
          syncedTransactionIds,
        );
        await this.transfersService.suggestTransfers(user.id, syncedTransactionIds);
      }

      await this.recomputeConnectionStats(bankConnectionId);

      await this.prisma.bankConnection.update({
        where: { id: bankConnectionId },
        data: {
          status: BankConnectionStatus.LINKED,
          lastSyncedAt: new Date(),
          lastError: null,
        },
      });

      await this.prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: SyncJobStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      return { syncedCount, syncJobId: syncJob.id, daysBack };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown sync error";

      await this.prisma.bankConnection.update({
        where: { id: bankConnectionId },
        data: {
          status: BankConnectionStatus.ERROR,
          lastError: message,
        },
      });

      await this.prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: SyncJobStatus.FAILED,
          completedAt: new Date(),
          error: message,
        },
      });

      throw error;
    }
  }

  private async resolveSyncedAccount(input: {
    userId: string;
    bankConnectionId: string;
    institutionName: string;
    externalAccountId: string;
    stored: {
      name: string;
      iban?: string;
      currency: string;
      accountType: string | null;
      product: string | null;
    };
    currentBalance: number;
  }) {
    const data = {
      bankConnectionId: input.bankConnectionId,
      externalId: input.externalAccountId,
      name: input.stored.name,
      iban: input.stored.iban,
      currency: input.stored.currency,
      accountType: input.stored.accountType,
      product: input.stored.product,
      institutionName: input.institutionName,
      provider: BankProvider.ENABLE_BANKING,
      currentBalance: input.currentBalance,
      isActive: true,
    };

    const byExternal = await this.prisma.account.findUnique({
      where: {
        userId_externalId: {
          userId: input.userId,
          externalId: input.externalAccountId,
        },
      },
    });
    if (byExternal) {
      return this.prisma.account.update({
        where: { id: byExternal.id },
        data,
      });
    }

    const incomingIban = normalizeIban(input.stored.iban);
    if (incomingIban) {
      const candidates = await this.prisma.account.findMany({
        where: {
          userId: input.userId,
          currency: input.stored.currency,
          NOT: { iban: null },
        },
      });
      const match = candidates.find(
        (account) => normalizeIban(account.iban) === incomingIban,
      );
      if (match) {
        return this.prisma.account.update({
          where: { id: match.id },
          data,
        });
      }
    }

    return this.prisma.account.create({
      data: {
        userId: input.userId,
        ...data,
      },
    });
  }

  private buildCursorFilter(
    cursor: TransactionCursor,
  ): Prisma.TransactionWhereInput {
    const bookedAt = new Date(cursor.bookedAt);
    return {
      OR: [
        { bookedAt: { lt: bookedAt } },
        {
          bookedAt,
          id: { lt: cursor.id },
        },
      ],
    };
  }

  private async ensureConnectionStats(connection: {
    id: string;
    stats: {
      totalIncome: { toString(): string };
      totalSpent: { toString(): string };
      netFlow: { toString(): string };
      transactionCount: number;
      avgTransactionSize: { toString(): string };
      thisMonthIncome: { toString(): string };
      thisMonthSpent: { toString(): string };
      computedAt: Date;
    } | null;
  }): Promise<ConnectionStats> {
    if (
      connection.stats &&
      this.fx.isConvertedCacheFresh(connection.stats.computedAt)
    ) {
      return connectionStatsFromRow(connection.stats);
    }

    return this.recomputeConnectionStats(connection.id);
  }

  private async recomputeConnectionStats(
    bankConnectionId: string,
  ): Promise<ConnectionStats> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: { bankConnectionId },
      },
      select: { amount: true, bookedAt: true, currency: true },
    });

    const rates = await this.fx.getRates();
    const stats =
      transactions.length > 0
        ? computeStats(transactions, (amount, currency) =>
            this.fx.toEur(amount, currency, rates),
          )
        : EMPTY_STATS;

    await this.prisma.connectionStats.upsert({
      where: { bankConnectionId },
      create: {
        bankConnectionId,
        ...connectionStatsToDb(stats),
      },
      update: connectionStatsToDb(stats),
    });

    return stats;
  }

  private isBankHexId(externalId: string) {
    return /^[0-9A-F]{32}$/i.test(externalId);
  }

  /** Fallback IDs we generate when the bank omits entry_reference / transaction_id. */
  private isFallbackSyntheticId(externalId: string) {
    return (
      this.isLegacySyntheticId(externalId) ||
      /^-?\d+(\.\d+)?-/.test(externalId)
    );
  }

  private isLegacySyntheticId(externalId: string) {
    return /^\d{4}-\d{2}-\d{2}-/.test(externalId);
  }

  private preferExternalId(next: string, current: string | null) {
    if (!current) return next;
    const nextBank = this.isBankHexId(next);
    const currentBank = this.isBankHexId(current);
    if (nextBank && !currentBank) return next;
    if (!nextBank && currentBank) return current;
    const nextLegacy = this.isLegacySyntheticId(next);
    const currentLegacy = this.isLegacySyntheticId(current);
    if (currentLegacy && !nextLegacy) return next;
    if (!currentLegacy && nextLegacy) return current;
    return next;
  }

  /**
   * Detect the same bank row reappearing with a shifted booking date (pending → posted).
   * Intentionally narrow: never merges two bank hex IDs or purchases on different days.
   */
  private isBookingDateShiftDuplicate(
    incoming: ExternalTransaction,
    existing: {
      externalId: string | null;
      bookedAt: Date;
      amount: { toString(): string };
      description: string;
    },
  ) {
    if (existing.externalId === incoming.externalId) return false;

    if (
      existing.externalId &&
      this.isBankHexId(existing.externalId) &&
      this.isBankHexId(incoming.externalId)
    ) {
      return false;
    }

    if (existing.description !== incoming.description) return false;
    if (Number(existing.amount.toString()) !== incoming.amount) return false;

    const incomingDay = Math.floor(incoming.bookedAt.getTime() / 86_400_000);
    const existingDay = Math.floor(existing.bookedAt.getTime() / 86_400_000);
    if (Math.abs(incomingDay - existingDay) > 2) return false;

    const incomingSynthetic = this.isFallbackSyntheticId(incoming.externalId);
    const existingSynthetic = existing.externalId
      ? this.isFallbackSyntheticId(existing.externalId)
      : false;

    return incomingSynthetic || existingSynthetic;
  }

  private bookingShiftWindow(bookedAt: Date) {
    const start = new Date(bookedAt);
    start.setDate(start.getDate() - 2);
    start.setHours(0, 0, 0, 0);
    const end = new Date(bookedAt);
    end.setDate(end.getDate() + 2);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private async upsertSyncedTransaction(
    accountId: string,
    tx: ExternalTransaction,
  ) {
    const { start, end } = this.bookingShiftWindow(tx.bookedAt);
    const candidates = await this.prisma.transaction.findMany({
      where: {
        accountId,
        amount: tx.amount,
        description: tx.description,
        bookedAt: { gte: start, lte: end },
        NOT: { externalId: tx.externalId },
      },
      orderBy: [{ bookedAt: "desc" }, { createdAt: "asc" }],
      take: 5,
    });

    const duplicate = candidates.find((row) =>
      this.isBookingDateShiftDuplicate(tx, row),
    );

    if (duplicate) {
      const updated = await this.prisma.transaction.update({
        where: { id: duplicate.id },
        data: {
          externalId: this.preferExternalId(
            tx.externalId,
            duplicate.externalId,
          ),
          amount: tx.amount,
          currency: tx.currency,
          description: tx.description,
          merchant: tx.merchant,
          bookedAt: tx.bookedAt,
        },
      });
      return { id: updated.id, isNew: false };
    }

    const existing = await this.prisma.transaction.findUnique({
      where: {
        accountId_externalId: {
          accountId,
          externalId: tx.externalId,
        },
      },
      select: { id: true },
    });

    const saved = await this.prisma.transaction.upsert({
      where: {
        accountId_externalId: {
          accountId,
          externalId: tx.externalId,
        },
      },
      create: {
        accountId,
        externalId: tx.externalId,
        amount: tx.amount,
        currency: tx.currency,
        description: tx.description,
        merchant: tx.merchant,
        bookedAt: tx.bookedAt,
      },
      update: {
        amount: tx.amount,
        description: tx.description,
        merchant: tx.merchant,
        bookedAt: tx.bookedAt,
      },
    });

    return { id: saved.id, isNew: !existing };
  }

  private resolveRedirectUrl(clientRedirectUrl: string): string {
    const configured =
      this.config.get<string>("BANK_REDIRECT_URL")?.trim() ||
      (this.config.get<string>("WEB_URL")?.trim()
        ? `${this.config.get<string>("WEB_URL")!.replace(/\/$/, "")}/bank/callback`
        : undefined);
    return configured || clientRedirectUrl;
  }

  private async createAuthLink(
    institutionId: string,
    redirectUrl: string,
    referenceId?: string,
  ) {
    const resolvedRedirectUrl = this.resolveRedirectUrl(redirectUrl);
    try {
      return await this.provider.createBankLink(
        institutionId,
        resolvedRedirectUrl,
        referenceId,
      );
    } catch (error) {
      throw this.mapBankLinkError(error, resolvedRedirectUrl);
    }
  }

  private mapBankLinkError(
    error: unknown,
    redirectUrl: string,
  ): BadRequestException {
    if (error instanceof EnableBankingApiError) {
      if (error.body.error === "REDIRECT_URI_NOT_ALLOWED") {
        return new BadRequestException(
          `Redirect URI not allowed by Enable Banking: ${redirectUrl}. ` +
            `Production apps require an exact HTTPS match in API applications → Redirect URIs ` +
            `(http://localhost is often rejected). BOI may have connected earlier with a different whitelisted URL. ` +
            `Add your HTTPS callback (e.g. Vercel or ngrok) to Enable Banking, set BANK_REDIRECT_URL in .env, and restart the API.`,
        );
      }
      return new BadRequestException(
        error.body.message ?? "Enable Banking rejected the bank link request",
      );
    }
    if (error instanceof Error) {
      return new BadRequestException(error.message);
    }
    return new BadRequestException("Failed to start bank authorisation");
  }

  private mapRequisitionStatus(status: string): BankConnectionStatus {
    const normalized = status.toUpperCase();
    if (normalized === "AUTHORIZED" || normalized === "LN") {
      return BankConnectionStatus.LINKED;
    }
    if (normalized === "EX" || normalized === "EXPIRED") {
      return BankConnectionStatus.EXPIRED;
    }
    return BankConnectionStatus.PENDING;
  }

  /** Temporary helper until auth is implemented */
  private async ensureDemoUser() {
    return this.prisma.user.upsert({
      where: { email: "demo@poca.local" },
      create: {
        email: "demo@poca.local",
        name: "Demo User",
      },
      update: {},
    });
  }
}
