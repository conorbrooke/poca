import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  LinkTransferInput,
  TransactionTransferInfo,
  TransfersQuery,
  TransfersSummaryResponse,
} from "@poca/shared";
import { CategoryKind, TransferLinkStatus } from "@poca/db";
import { PrismaService } from "../prisma/prisma.module";
import { FxService } from "../fx/fx.service";
import { resolveSpendingPeriod, roundMoney } from "./period";
import { toNumber } from "./mappers";
import { matchTransferPairs } from "./transfer-matching";

type TxWithAccount = {
  id: string;
  amount: { toString(): string };
  currency: string;
  payeeLabel: string | null;
  bookedAt: Date;
  account: {
    name: string;
    bankConnection: { institutionName: string } | null;
  };
};

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
  ) {}

  async suggestTransfers(userId: string, transactionIds?: string[]) {
    const transferCategoryIds = await this.getTransferCategoryIds(userId);
    if (transferCategoryIds.length === 0) return { created: 0, updated: 0 };

    const existing = await this.prisma.accountTransfer.findMany({
      where: { userId },
      select: { outTransactionId: true, inTransactionId: true },
    });
    const linkedOut = new Set(existing.map((row) => row.outTransactionId));
    const linkedIn = new Set(
      existing.map((row) => row.inTransactionId).filter(Boolean) as string[],
    );

    const accountFilter = { userId };
    const idFilter = transactionIds?.length ? { id: { in: transactionIds } } : {};

    const outflows = await this.prisma.transaction.findMany({
      where: {
        ...idFilter,
        amount: { lt: 0 },
        isSplit: false,
        categoryId: { in: transferCategoryIds },
        account: accountFilter,
      },
      select: {
        id: true,
        accountId: true,
        amount: true,
        bookedAt: true,
        category: { select: { kind: true } },
      },
    });

    const inflows = await this.prisma.transaction.findMany({
      where: {
        amount: { gt: 0 },
        isSplit: false,
        account: accountFilter,
      },
      select: {
        id: true,
        accountId: true,
        amount: true,
        bookedAt: true,
        category: { select: { kind: true } },
      },
    });

    const matches = matchTransferPairs(
      outflows.map((row) => ({
        id: row.id,
        accountId: row.accountId,
        amount: toNumber(row.amount),
        bookedAt: row.bookedAt,
        categoryKind: row.category?.kind ?? null,
      })),
      inflows.map((row) => ({
        id: row.id,
        accountId: row.accountId,
        amount: toNumber(row.amount),
        bookedAt: row.bookedAt,
        categoryKind: row.category?.kind ?? null,
      })),
      { linkedOutIds: linkedOut, linkedInIds: linkedIn },
    );

    let created = 0;
    let updated = 0;

    for (const match of matches) {
      const status =
        match.confidence === "high"
          ? TransferLinkStatus.CONFIRMED
          : TransferLinkStatus.SUGGESTED;

      const existingLink = await this.prisma.accountTransfer.findUnique({
        where: { outTransactionId: match.outId },
      });

      if (existingLink) {
        if (!existingLink.inTransactionId && match.inId) {
          await this.prisma.accountTransfer.update({
            where: { id: existingLink.id },
            data: {
              inTransactionId: match.inId,
              status,
            },
          });
          updated++;
        }
        continue;
      }

      await this.prisma.accountTransfer.create({
        data: {
          userId,
          outTransactionId: match.outId,
          inTransactionId: match.inId,
          status,
        },
      });
      created++;
    }

    const matchedOutIds = new Set(matches.map((match) => match.outId));
    for (const out of outflows) {
      if (linkedOut.has(out.id) || matchedOutIds.has(out.id)) continue;
      const already = await this.prisma.accountTransfer.findUnique({
        where: { outTransactionId: out.id },
      });
      if (already) continue;
      await this.prisma.accountTransfer.create({
        data: {
          userId,
          outTransactionId: out.id,
          status: TransferLinkStatus.SUGGESTED,
        },
      });
      created++;
    }

    return { created, updated };
  }

  async getSummary(
    userId: string,
    query: TransfersQuery,
  ): Promise<TransfersSummaryResponse> {
    const period = resolveSpendingPeriod(query);
    const { periodStart, periodEnd } = period;
    const accountFilter = query.bankConnectionId
      ? { userId, bankConnectionId: query.bankConnectionId }
      : { userId };

    const links = await this.prisma.accountTransfer.findMany({
      where: {
        userId,
        outTransaction: {
          bookedAt: { gte: periodStart, lte: periodEnd },
          account: accountFilter,
        },
      },
      include: {
        outTransaction: {
          include: {
            account: {
              include: { bankConnection: { select: { institutionName: true } } },
            },
          },
        },
        inTransaction: {
          include: {
            account: {
              include: { bankConnection: { select: { institutionName: true } } },
            },
          },
        },
      },
      orderBy: { outTransaction: { bookedAt: "desc" } },
    });

    const transfers = links.map((link) => this.mapLink(link));
    const rates = await this.fx.getRates();
    const totalTransferred = roundMoney(
      transfers.reduce(
        (sum, row) =>
          sum + Math.abs(this.fx.toEur(row.amount, row.currency, rates)),
        0,
      ),
    );
    const linkedCount = transfers.filter((row) => row.in).length;
    const unlinkedCount = transfers.length - linkedCount;

    return {
      range: period.kind,
      periodLabel: period.label,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalTransferred,
      transactionCount: transfers.length,
      linkedCount,
      unlinkedCount,
      transfers,
    };
  }

  async linkTransfer(userId: string, input: LinkTransferInput) {
    const [outTx, inTx] = await Promise.all([
      this.requireTransaction(userId, input.outTransactionId),
      this.requireTransaction(userId, input.inTransactionId),
    ]);

    if (toNumber(outTx.amount) >= 0) {
      throw new BadRequestException("Outflow transaction must be negative");
    }
    if (toNumber(inTx.amount) <= 0) {
      throw new BadRequestException("Inflow transaction must be positive");
    }
    if (outTx.accountId === inTx.accountId) {
      throw new BadRequestException("Transfers must be between different accounts");
    }
    if (
      Math.abs(Math.abs(toNumber(outTx.amount)) - toNumber(inTx.amount)) >= 0.01
    ) {
      throw new BadRequestException("Transfer amounts must match");
    }

    const existingIn = await this.prisma.accountTransfer.findUnique({
      where: { inTransactionId: input.inTransactionId },
    });
    if (existingIn && existingIn.outTransactionId !== input.outTransactionId) {
      throw new BadRequestException("Inflow is already linked to another transfer");
    }

    const link = await this.prisma.accountTransfer.upsert({
      where: { outTransactionId: input.outTransactionId },
      create: {
        userId,
        outTransactionId: input.outTransactionId,
        inTransactionId: input.inTransactionId,
        status: TransferLinkStatus.CONFIRMED,
      },
      update: {
        inTransactionId: input.inTransactionId,
        status: TransferLinkStatus.CONFIRMED,
      },
      include: {
        outTransaction: {
          include: {
            account: {
              include: { bankConnection: { select: { institutionName: true } } },
            },
          },
        },
        inTransaction: {
          include: {
            account: {
              include: { bankConnection: { select: { institutionName: true } } },
            },
          },
        },
      },
    });

    return this.mapLink(link);
  }

  async confirmTransfer(userId: string, transferId: string) {
    const link = await this.requireTransfer(userId, transferId);
    return this.prisma.accountTransfer.update({
      where: { id: link.id },
      data: { status: TransferLinkStatus.CONFIRMED },
    });
  }

  async unlinkTransfer(userId: string, transferId: string) {
    const link = await this.requireTransfer(userId, transferId);
    await this.prisma.accountTransfer.delete({ where: { id: link.id } });
    return { deleted: true };
  }

  async loadTransferInfoByTransactionIds(
    userId: string,
    transactionIds: string[],
  ): Promise<Map<string, TransactionTransferInfo>> {
    if (transactionIds.length === 0) return new Map();

    const links = await this.prisma.accountTransfer.findMany({
      where: {
        userId,
        OR: [
          { outTransactionId: { in: transactionIds } },
          { inTransactionId: { in: transactionIds } },
        ],
      },
      include: {
        outTransaction: {
          include: {
            account: {
              include: { bankConnection: { select: { institutionName: true } } },
            },
          },
        },
        inTransaction: {
          include: {
            account: {
              include: { bankConnection: { select: { institutionName: true } } },
            },
          },
        },
      },
    });

    const map = new Map<string, TransactionTransferInfo>();
    for (const link of links) {
      const outInfo = this.mapCounterparty(link.outTransaction);
      const inInfo = link.inTransaction
        ? this.mapCounterparty(link.inTransaction)
        : null;

      map.set(link.outTransactionId, {
        id: link.id,
        status: link.status,
        direction: "out",
        counterparty: inInfo,
      });

      if (link.inTransactionId) {
        map.set(link.inTransactionId, {
          id: link.id,
          status: link.status,
          direction: "in",
          counterparty: outInfo,
        });
      }
    }

    return map;
  }

  private mapLink(link: {
    id: string;
    status: TransferLinkStatus;
    outTransaction: TxWithAccount;
    inTransaction: TxWithAccount | null;
  }) {
    const amount = toNumber(link.outTransaction.amount);
    return {
      id: link.id,
      status: link.status,
      amount,
      currency: link.outTransaction.currency,
      bookedAt: link.outTransaction.bookedAt.toISOString(),
      out: this.mapCounterparty(link.outTransaction),
      in: link.inTransaction ? this.mapCounterparty(link.inTransaction) : null,
    };
  }

  private mapCounterparty(tx: TxWithAccount) {
    return {
      transactionId: tx.id,
      amount: toNumber(tx.amount),
      currency: tx.currency,
      accountName: tx.account.name,
      institutionName: tx.account.bankConnection?.institutionName ?? "",
      bookedAt: tx.bookedAt.toISOString(),
      payeeLabel: tx.payeeLabel,
    };
  }

  private async getTransferCategoryIds(userId: string) {
    const categories = await this.prisma.category.findMany({
      where: { userId, kind: CategoryKind.TRANSFER, deletedAt: null },
      select: { id: true },
    });
    return categories.map((row) => row.id);
  }

  private async requireTransaction(userId: string, transactionId: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, account: { userId } },
    });
    if (!tx) throw new NotFoundException("Transaction not found");
    return tx;
  }

  private async requireTransfer(userId: string, transferId: string) {
    const link = await this.prisma.accountTransfer.findFirst({
      where: { id: transferId, userId },
    });
    if (!link) throw new NotFoundException("Transfer not found");
    return link;
  }
}
