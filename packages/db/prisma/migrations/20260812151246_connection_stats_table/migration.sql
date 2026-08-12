/*
  Warnings:

  - You are about to drop the column `cachedStats` on the `BankConnection` table. All the data in the column will be lost.
  - You are about to drop the column `statsComputedAt` on the `BankConnection` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BankConnection" DROP COLUMN "cachedStats",
DROP COLUMN "statsComputedAt";

-- CreateTable
CREATE TABLE "ConnectionStats" (
    "id" TEXT NOT NULL,
    "bankConnectionId" TEXT NOT NULL,
    "totalIncome" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netFlow" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "avgTransactionSize" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "thisMonthIncome" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "thisMonthSpent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectionStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionStats_bankConnectionId_key" ON "ConnectionStats"("bankConnectionId");

-- CreateIndex
CREATE INDEX "ConnectionStats_bankConnectionId_idx" ON "ConnectionStats"("bankConnectionId");

-- AddForeignKey
ALTER TABLE "ConnectionStats" ADD CONSTRAINT "ConnectionStats_bankConnectionId_fkey" FOREIGN KEY ("bankConnectionId") REFERENCES "BankConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
