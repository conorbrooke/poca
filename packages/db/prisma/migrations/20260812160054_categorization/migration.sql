-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "payeeLabel" TEXT;

-- CreateTable
CREATE TABLE "CategoryRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "matchText" TEXT NOT NULL,
    "payeeLabel" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryPeriodStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "bankConnectionId" TEXT,
    "rangeType" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "totalSpent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryPeriodStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayeePeriodStat" (
    "id" TEXT NOT NULL,
    "categoryPeriodStatId" TEXT NOT NULL,
    "payeeLabel" TEXT NOT NULL,
    "totalSpent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayeePeriodStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryRule_userId_idx" ON "CategoryRule"("userId");

-- CreateIndex
CREATE INDEX "CategoryRule_categoryId_idx" ON "CategoryRule"("categoryId");

-- CreateIndex
CREATE INDEX "CategoryRule_userId_priority_idx" ON "CategoryRule"("userId", "priority");

-- CreateIndex
CREATE INDEX "CategoryPeriodStat_userId_rangeType_periodStart_idx" ON "CategoryPeriodStat"("userId", "rangeType", "periodStart");

-- CreateIndex
CREATE INDEX "CategoryPeriodStat_categoryId_idx" ON "CategoryPeriodStat"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryPeriodStat_userId_categoryId_bankConnectionId_range_key" ON "CategoryPeriodStat"("userId", "categoryId", "bankConnectionId", "rangeType", "periodStart");

-- CreateIndex
CREATE INDEX "PayeePeriodStat_categoryPeriodStatId_idx" ON "PayeePeriodStat"("categoryPeriodStatId");

-- CreateIndex
CREATE UNIQUE INDEX "PayeePeriodStat_categoryPeriodStatId_payeeLabel_key" ON "PayeePeriodStat"("categoryPeriodStatId", "payeeLabel");

-- CreateIndex
CREATE INDEX "Transaction_payeeLabel_idx" ON "Transaction"("payeeLabel");

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryPeriodStat" ADD CONSTRAINT "CategoryPeriodStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryPeriodStat" ADD CONSTRAINT "CategoryPeriodStat_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayeePeriodStat" ADD CONSTRAINT "PayeePeriodStat_categoryPeriodStatId_fkey" FOREIGN KEY ("categoryPeriodStatId") REFERENCES "CategoryPeriodStat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
