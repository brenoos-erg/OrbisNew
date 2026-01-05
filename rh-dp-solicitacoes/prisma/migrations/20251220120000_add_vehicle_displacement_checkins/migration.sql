-- CreateTable
CREATE TABLE "VehicleDisplacementCheckin" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "tripDate" TIMESTAMP(3) NOT NULL,
    "costCenterId" TEXT,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "vehiclePlateSnapshot" TEXT NOT NULL,
    "vehicleTypeSnapshot" TEXT NOT NULL,
    "vehicleModelSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleDisplacementCheckin_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VehicleDisplacementCheckin" ADD CONSTRAINT "VehicleDisplacementCheckin_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDisplacementCheckin" ADD CONSTRAINT "VehicleDisplacementCheckin_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDisplacementCheckin" ADD CONSTRAINT "VehicleDisplacementCheckin_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
