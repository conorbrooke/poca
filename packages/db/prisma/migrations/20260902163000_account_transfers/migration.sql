-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransferLinkStatus" AS ENUM ('SUGGESTED', 'CONFIRMED');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "kind" "CategoryKind" NOT NULL DEFAULT 'EXPENSE';

UPDATE "Category" SET "kind" = 'TRANSFER' WHERE "name" = 'Transfers';
UPDATE "Category" SET "kind" = 'INCOME' WHERE "name" = 'Income';

-- CreateTable
CREATE TABLE "AccountTransfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outTransactionId" TEXT NOT NULL,
    "inTransactionId" TEXT,
    "status" "TransferLinkStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransfer_outTransactionId_key" ON "AccountTransfer"("outTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransfer_inTransactionId_key" ON "AccountTransfer"("inTransactionId");

-- CreateIndex
CREATE INDEX "AccountTransfer_userId_idx" ON "AccountTransfer"("userId");

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_outTransactionId_fkey" FOREIGN KEY ("outTransactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_inTransactionId_fkey" FOREIGN KEY ("inTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
