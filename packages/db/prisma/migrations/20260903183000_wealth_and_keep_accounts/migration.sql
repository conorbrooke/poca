-- AlterTable
ALTER TABLE "Account" ADD COLUMN "institutionName" TEXT;

-- CreateEnum
CREATE TYPE "BillCadence" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SavingsGoalKind" AS ENUM ('EMERGENCY', 'HOUSE', 'CAR', 'HOLIDAY', 'GENERAL');

-- CreateEnum
CREATE TYPE "WealthSide" AS ENUM ('ASSET', 'LIABILITY');

-- CreateEnum
CREATE TYPE "WealthClass" AS ENUM ('BANK_CASH', 'PROPERTY', 'VEHICLE', 'PENSION', 'INVESTMENT', 'OTHER', 'MORTGAGE', 'LOAN', 'CREDIT_CARD', 'PERSONAL');

-- CreateEnum
CREATE TYPE "PensionKind" AS ENUM ('OCCUPATIONAL', 'PRSA', 'AVC');

-- CreateTable
CREATE TABLE "MonthlyBudget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "overallCap" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "payeeMatch" TEXT,
    "typicalAmount" DECIMAL(14,2) NOT NULL,
    "cadence" "BillCadence" NOT NULL DEFAULT 'MONTHLY',
    "nextDue" DATE,
    "isEssential" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SavingsGoalKind" NOT NULL DEFAULT 'GENERAL',
    "targetAmount" DECIMAL(14,2) NOT NULL,
    "targetDate" DATE,
    "currentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "accountId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WealthItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "side" "WealthSide" NOT NULL,
    "class" "WealthClass" NOT NULL,
    "currentValue" DECIMAL(14,2) NOT NULL,
    "accountId" TEXT,
    "interestRate" DECIMAL(7,4),
    "minimumPayment" DECIMAL(14,2),
    "pensionKind" "PensionKind",
    "employerMatchAnnual" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WealthItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "averageCost" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "broker" TEXT,
    "lastPrice" DECIMAL(14,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetWorthSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asOf" DATE NOT NULL,
    "totalAssets" DECIMAL(14,2) NOT NULL,
    "totalLiabilities" DECIMAL(14,2) NOT NULL,
    "netWorth" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBudget_userId_year_month_key" ON "MonthlyBudget"("userId", "year", "month");
CREATE INDEX "MonthlyBudget_userId_idx" ON "MonthlyBudget"("userId");

CREATE UNIQUE INDEX "BudgetLine_budgetId_categoryId_key" ON "BudgetLine"("budgetId", "categoryId");
CREATE INDEX "BudgetLine_categoryId_idx" ON "BudgetLine"("categoryId");

CREATE INDEX "RecurringBill_userId_idx" ON "RecurringBill"("userId");
CREATE INDEX "RecurringBill_categoryId_idx" ON "RecurringBill"("categoryId");

CREATE INDEX "SavingsGoal_userId_idx" ON "SavingsGoal"("userId");
CREATE INDEX "SavingsGoal_accountId_idx" ON "SavingsGoal"("accountId");

CREATE INDEX "WealthItem_userId_idx" ON "WealthItem"("userId");
CREATE INDEX "WealthItem_accountId_idx" ON "WealthItem"("accountId");

CREATE INDEX "Holding_userId_idx" ON "Holding"("userId");

CREATE UNIQUE INDEX "NetWorthSnapshot_userId_asOf_key" ON "NetWorthSnapshot"("userId", "asOf");
CREATE INDEX "NetWorthSnapshot_userId_idx" ON "NetWorthSnapshot"("userId");

-- AddForeignKey
ALTER TABLE "MonthlyBudget" ADD CONSTRAINT "MonthlyBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "MonthlyBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringBill" ADD CONSTRAINT "RecurringBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringBill" ADD CONSTRAINT "RecurringBill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WealthItem" ADD CONSTRAINT "WealthItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WealthItem" ADD CONSTRAINT "WealthItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetWorthSnapshot" ADD CONSTRAINT "NetWorthSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
