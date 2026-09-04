-- Variable living categories, confirmed bill payees, wealth proof ledgers.

ALTER TABLE "Category" ADD COLUMN "isVariable" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Category"
SET "isVariable" = true, "isEssential" = true
WHERE "kind" = 'EXPENSE' AND "name" IN ('Groceries', 'Fuel');

CREATE TYPE "BillPayeeStatus" AS ENUM ('CONFIRMED', 'IGNORED');

CREATE TABLE "ConfirmedBillPayee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "payeeLabel" TEXT NOT NULL,
    "status" "BillPayeeStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfirmedBillPayee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfirmedBillPayee_categoryId_payeeLabel_key" ON "ConfirmedBillPayee"("categoryId", "payeeLabel");
CREATE INDEX "ConfirmedBillPayee_userId_idx" ON "ConfirmedBillPayee"("userId");
CREATE INDEX "ConfirmedBillPayee_categoryId_idx" ON "ConfirmedBillPayee"("categoryId");

ALTER TABLE "ConfirmedBillPayee" ADD CONSTRAINT "ConfirmedBillPayee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConfirmedBillPayee" ADD CONSTRAINT "ConfirmedBillPayee_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One-time: confirm payees that appeared in bill categories last complete calendar month.
INSERT INTO "ConfirmedBillPayee" ("id", "userId", "categoryId", "payeeLabel", "status", "createdAt", "updatedAt")
SELECT DISTINCT ON (c.id, COALESCE(NULLIF(BTRIM(t."payeeLabel"), ''), LEFT(t.description, 40)))
    'c' || substr(md5(c.id || COALESCE(NULLIF(BTRIM(t."payeeLabel"), ''), LEFT(t.description, 40))), 1, 24),
    c."userId",
    c.id,
    COALESCE(NULLIF(BTRIM(t."payeeLabel"), ''), LEFT(t.description, 40)),
    'CONFIRMED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Transaction" t
JOIN "Category" c ON c.id = t."categoryId"
WHERE c."isBill" = true
  AND c."deletedAt" IS NULL
  AND t.amount < 0
  AND t."bookedAt" >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
  AND t."bookedAt" < date_trunc('month', CURRENT_DATE)
ON CONFLICT ("categoryId", "payeeLabel") DO NOTHING;

CREATE TYPE "WealthLedgerRole" AS ENUM ('PURCHASE', 'OPENING', 'REPAYMENT', 'INCREASE');
CREATE TYPE "WealthValuationSource" AS ENUM ('TRANSACTION', 'OPENING', 'MANUAL_PERCENT', 'MANUAL_AMOUNT', 'DEPRECIATION');

ALTER TABLE "WealthItem" ADD COLUMN "depreciationPercentYearly" DECIMAL(7, 4);

CREATE TABLE "WealthItemLedger" (
    "id" TEXT NOT NULL,
    "wealthItemId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "role" "WealthLedgerRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WealthItemLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WealthItemLedger_transactionId_key" ON "WealthItemLedger"("transactionId");
CREATE INDEX "WealthItemLedger_wealthItemId_idx" ON "WealthItemLedger"("wealthItemId");

ALTER TABLE "WealthItemLedger" ADD CONSTRAINT "WealthItemLedger_wealthItemId_fkey" FOREIGN KEY ("wealthItemId") REFERENCES "WealthItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WealthItemLedger" ADD CONSTRAINT "WealthItemLedger_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WealthItemValuation" (
    "id" TEXT NOT NULL,
    "wealthItemId" TEXT NOT NULL,
    "asOf" DATE NOT NULL,
    "value" DECIMAL(14, 2) NOT NULL,
    "source" "WealthValuationSource" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WealthItemValuation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WealthItemValuation_wealthItemId_asOf_source_key" ON "WealthItemValuation"("wealthItemId", "asOf", "source");
CREATE INDEX "WealthItemValuation_wealthItemId_asOf_idx" ON "WealthItemValuation"("wealthItemId", "asOf");

ALTER TABLE "WealthItemValuation" ADD CONSTRAINT "WealthItemValuation_wealthItemId_fkey" FOREIGN KEY ("wealthItemId") REFERENCES "WealthItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
