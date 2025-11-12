-- CreateTable
CREATE TABLE "CostCenterModule" (
    "id" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostCenterModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CostCenterModule_costCenterId_moduleId_key" ON "CostCenterModule"("costCenterId", "moduleId");

-- AddForeignKey
ALTER TABLE "CostCenterModule" ADD CONSTRAINT "CostCenterModule_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenterModule" ADD CONSTRAINT "CostCenterModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
