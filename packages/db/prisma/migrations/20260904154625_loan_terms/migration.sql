-- AlterTable
ALTER TABLE "WealthItem" ADD COLUMN     "annualPercentageRate" DECIMAL(7,4),
ADD COLUMN     "totalCostOfCredit" DECIMAL(14,2),
ADD COLUMN     "totalRepaymentAmount" DECIMAL(14,2);
