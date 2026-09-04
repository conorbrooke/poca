-- Goal pots are funded by a linked account and/or assigned transactions.
CREATE TABLE "GoalFunding" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalFunding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoalFunding_transactionId_key" ON "GoalFunding"("transactionId");
CREATE INDEX "GoalFunding_goalId_idx" ON "GoalFunding"("goalId");

ALTER TABLE "GoalFunding" ADD CONSTRAINT "GoalFunding_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "SavingsGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoalFunding" ADD CONSTRAINT "GoalFunding_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
