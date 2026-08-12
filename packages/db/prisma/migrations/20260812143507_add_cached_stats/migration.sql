-- AlterTable
ALTER TABLE "BankConnection" ADD COLUMN     "cachedStats" JSONB,
ADD COLUMN     "statsComputedAt" TIMESTAMP(3);
