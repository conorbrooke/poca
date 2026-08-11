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
