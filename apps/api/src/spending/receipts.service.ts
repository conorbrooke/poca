import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.module";

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  private receiptsDir() {
    return (
      process.env.RECEIPTS_DIR?.trim() ||
      path.resolve(process.cwd(), "data/receipts")
    );
  }

  async listReceipts(userId: string, transactionId: string) {
    await this.requireParent(userId, transactionId);
    return this.prisma.transactionReceipt.findMany({
      where: { transactionId },
      orderBy: { createdAt: "asc" },
    });
  }

  async uploadReceipt(
    userId: string,
    transactionId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    const transaction = await this.requireParent(userId, transactionId);
    const extension = ALLOWED_MIME[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        "Receipts must be JPEG, PNG, WebP, or PDF",
      );
    }

    const dir = this.receiptsDir();
    await mkdir(dir, { recursive: true });

    const label = this.sanitizeLabel(
      transaction.payeeLabel ?? transaction.description,
    );
    const bankId = transaction.externalId ?? transaction.id;
    const existingCount = await this.prisma.transactionReceipt.count({
      where: { transactionId },
    });
    const suffix = existingCount === 0 ? "" : `-${existingCount + 1}`;
    const storedName = `${label}-${bankId}${suffix}${extension}`;
    const storedPath = path.join(dir, storedName);

    await writeFile(storedPath, file.buffer);

    return this.prisma.transactionReceipt.create({
      data: {
        transactionId,
        originalName: file.originalname,
        storedName,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });
  }

  async streamReceipt(userId: string, transactionId: string, receiptId: string) {
    const receipt = await this.prisma.transactionReceipt.findFirst({
      where: {
        id: receiptId,
        transactionId,
        transaction: { account: { userId } },
      },
    });
    if (!receipt) throw new NotFoundException("Receipt not found");

    const filePath = path.join(this.receiptsDir(), receipt.storedName);
    return new StreamableFile(createReadStream(filePath), {
      type: receipt.mimeType,
      disposition: `inline; filename="${receipt.storedName}"`,
    });
  }

  async deleteReceipt(userId: string, transactionId: string, receiptId: string) {
    const receipt = await this.prisma.transactionReceipt.findFirst({
      where: {
        id: receiptId,
        transactionId,
        transaction: { account: { userId } },
      },
    });
    if (!receipt) throw new NotFoundException("Receipt not found");

    await this.prisma.transactionReceipt.delete({ where: { id: receipt.id } });
    try {
      await unlink(path.join(this.receiptsDir(), receipt.storedName));
    } catch {
      // File may already be missing from disk.
    }
    return { deleted: true };
  }

  private async requireParent(userId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, account: { userId } },
    });
    if (!transaction) throw new NotFoundException("Transaction not found");
    return transaction;
  }

  private sanitizeLabel(label: string) {
    const cleaned = label
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    return cleaned || "receipt";
  }
}
