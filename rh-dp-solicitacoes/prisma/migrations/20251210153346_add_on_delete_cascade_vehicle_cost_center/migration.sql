-- DropForeignKey
ALTER TABLE "VehicleCostCenter" DROP CONSTRAINT "VehicleCostCenter_vehicleId_fkey";

-- AddForeignKey
ALTER TABLE "VehicleCostCenter" ADD CONSTRAINT "VehicleCostCenter_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
