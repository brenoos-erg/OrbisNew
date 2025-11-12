-- CreateTable
CREATE TABLE "UserCostCenter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCostCenter_userId_costCenterId_key" ON "UserCostCenter"("userId", "costCenterId");

-- AddForeignKey
ALTER TABLE "UserCostCenter" ADD CONSTRAINT "UserCostCenter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCostCenter" ADD CONSTRAINT "UserCostCenter_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
