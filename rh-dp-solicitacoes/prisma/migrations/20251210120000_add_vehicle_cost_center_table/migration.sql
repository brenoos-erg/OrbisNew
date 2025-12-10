-- CreateTable
CREATE TABLE "VehicleCostCenter" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleCostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCostCenter_vehicleId_costCenterId_key" ON "VehicleCostCenter"("vehicleId", "costCenterId");

-- AddForeignKey
ALTER TABLE "VehicleCostCenter" ADD CONSTRAINT "VehicleCostCenter_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCostCenter" ADD CONSTRAINT "VehicleCostCenter_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;