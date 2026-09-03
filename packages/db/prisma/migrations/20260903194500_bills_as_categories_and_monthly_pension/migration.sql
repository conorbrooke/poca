-- Bills are expense categories, not a separate disconnected ledger.
ALTER TABLE "Category" ADD COLUMN "isBill" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Category" ADD COLUMN "isEssential" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Category" ADD COLUMN "billCadence" "BillCadence" NOT NULL DEFAULT 'MONTHLY';

UPDATE "Category"
SET "isBill" = true, "isEssential" = true
WHERE "kind" = 'EXPENSE' AND "name" IN ('Utilities', 'Insurance', 'Rent');

UPDATE "Category"
SET "isBill" = true, "isEssential" = false
WHERE "kind" = 'EXPENSE' AND "name" = 'Subscriptions';

-- MyFutureFund auto-enrolment: monthly employee / employer / State amounts.
CREATE TYPE "PensionKind_new" AS ENUM ('OCCUPATIONAL', 'PRSA', 'AVC', 'MYFUTUREFUND');
ALTER TABLE "WealthItem" ALTER COLUMN "pensionKind" TYPE "PensionKind_new" USING ("pensionKind"::text::"PensionKind_new");
ALTER TYPE "PensionKind" RENAME TO "PensionKind_old";
ALTER TYPE "PensionKind_new" RENAME TO "PensionKind";
DROP TYPE "PensionKind_old";

ALTER TABLE "WealthItem" ADD COLUMN "employeeContributionMonthly" DECIMAL(14, 2);
ALTER TABLE "WealthItem" ADD COLUMN "employerContributionMonthly" DECIMAL(14, 2);
ALTER TABLE "WealthItem" ADD COLUMN "stateContributionMonthly" DECIMAL(14, 2);
