import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EnableBankingProvider } from "@poca/bank-connect";
import type { BankConnectProvider } from "@poca/bank-connect";
import { BankConnectionStatus, BankProvider, SyncJobStatus } from "@poca/db";
import type {
  CompleteBankLinkInput,
  CreateBankLinkInput,
  SyncTransactionsInput,
} from "@poca/shared";
import { PrismaService } from "../prisma/prisma.module";

type TransactionRecord = {
  id: string;
  amount: { toString(): string };
  currency: string;
  description: string;
  merchant: string | null;
  bookedAt: Date;
};

function toNumber(value: { toString(): string }): number {
  return parseFloat(value.toString());
}

function computeStats(transactions: TransactionRecord[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalIncome = 0;
  let totalSpent = 0;
  let thisMonthIncome = 0;
  let thisMonthSpent = 0;

  for (const tx of transactions) {
    const amount = toNumber(tx.amount);
    const bookedAt = tx.bookedAt;

    if (amount >= 0) {
      totalIncome += amount;
      if (bookedAt >= monthStart) {
        thisMonthIncome += amount;
      }
    } else {
      totalSpent += Math.abs(amount);
      if (bookedAt >= monthStart) {
        thisMonthSpent += Math.abs(amount);
      }
    }
  }

  const transactionCount = transactions.length;
  const totalVolume = transactions.reduce(
    (sum, tx) => sum + Math.abs(toNumber(tx.amount)),
    0,
  );

  return {
    totalIncome: roundMoney(totalIncome),
    totalSpent: roundMoney(totalSpent),
    netFlow: roundMoney(totalIncome - totalSpent),
    transactionCount,
    avgTransactionSize: roundMoney(
      transactionCount > 0 ? totalVolume / transactionCount : 0,
    ),
    thisMonthIncome: roundMoney(thisMonthIncome),
    thisMonthSpent: roundMoney(thisMonthSpent),
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class BankService {
  private provider: BankConnectProvider;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
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
    const link = await this.provider.createBankLink(
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
      accounts: connection.accounts.map((account) => ({
        id: account.id,
        name: account.name,
        iban: account.iban,
        currentBalance: toNumber(account.currentBalance),
        currency: account.currency,
        transactionCount: account._count.transactions,
      })),
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
            transactions: {
              orderBy: { bookedAt: "desc" },
            },
            _count: { select: { transactions: true } },
          },
        },
      },
      orderBy: { institutionName: "asc" },
    });

    const allConnections = await this.prisma.bankConnection.findMany({
      where: { userId: user.id },
      select: { id: true, institutionName: true, status: true },
      orderBy: { institutionName: "asc" },
    });

    const dashboardConnections = connections.map((connection) => {
      const connectionTransactions = connection.accounts.flatMap(
        (account) => account.transactions,
      );
      const totalBalance = connection.accounts.reduce(
        (sum, account) => sum + toNumber(account.currentBalance),
        0,
      );
      const stats = computeStats(connectionTransactions);

      return {
        id: connection.id,
        institutionId: connection.institutionId,
        institutionName: connection.institutionName,
        status: connection.status,
        lastSyncedAt: connection.lastSyncedAt,
        lastError: connection.lastError,
        totalBalance: roundMoney(totalBalance),
        accounts: connection.accounts.map((account) => ({
          id: account.id,
          name: account.name,
          iban: account.iban,
          currentBalance: toNumber(account.currentBalance),
          currency: account.currency,
          transactionCount: account._count.transactions,
        })),
        stats,
      };
    });

    const transactions = connections
      .flatMap((connection) =>
        connection.accounts.flatMap((account) =>
          account.transactions.map((tx) => ({
            id: tx.id,
            amount: toNumber(tx.amount),
            currency: tx.currency,
            description: tx.description,
            merchant: tx.merchant,
            bookedAt: tx.bookedAt.toISOString(),
            accountId: account.id,
            accountName: account.name,
            accountIban: account.iban,
            bankConnectionId: connection.id,
            institutionName: connection.institutionName,
          })),
        ),
      )
      .sort(
        (a, b) =>
          new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime(),
      );

    const allTransactions = connections.flatMap((connection) =>
      connection.accounts.flatMap((account) => account.transactions),
    );
    const overallBalance = connections.reduce(
      (sum, connection) =>
        sum +
        connection.accounts.reduce(
          (accountSum, account) =>
            accountSum + toNumber(account.currentBalance),
          0,
        ),
      0,
    );
    const overallStats = {
      ...computeStats(allTransactions),
      totalBalance: roundMoney(overallBalance),
    };

    return {
      connections: allConnections,
      banks: dashboardConnections,
      transactions,
      stats: overallStats,
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
    const { bankConnectionId, dateFrom, dateTo } = input;

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

      for (const externalAccountId of requisition.accountIds) {
        const externalAccount =
          await this.provider.getAccount(externalAccountId);
        const balances = await this.provider.getBalances(externalAccountId);
        const currentBalance =
          balances.find((b) => b.currency === "EUR")?.amount ??
          balances[0]?.amount ??
          0;

        const account = await this.prisma.account.upsert({
          where: {
            userId_externalId: {
              userId: user.id,
              externalId: externalAccountId,
            },
          },
          create: {
            userId: user.id,
            bankConnectionId,
            externalId: externalAccountId,
            name: externalAccount.name ?? "Bank account",
            iban: externalAccount.iban,
            currency: externalAccount.currency ?? "EUR",
            provider: BankProvider.ENABLE_BANKING,
            currentBalance,
          },
          update: {
            name: externalAccount.name ?? "Bank account",
            iban: externalAccount.iban,
            currentBalance,
          },
        });

        const transactions = await this.provider.getTransactions(
          externalAccountId,
          dateFrom,
          dateTo,
        );

        for (const tx of transactions) {
          await this.prisma.transaction.upsert({
            where: {
              accountId_externalId: {
                accountId: account.id,
                externalId: tx.externalId,
              },
            },
            create: {
              accountId: account.id,
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
          syncedCount++;
        }
      }

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

      return { syncedCount, syncJobId: syncJob.id };
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
