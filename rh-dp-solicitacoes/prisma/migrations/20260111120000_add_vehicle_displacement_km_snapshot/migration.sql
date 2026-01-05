-- Capture quilometragem registrada no check-in de deslocamento
ALTER TABLE "VehicleDisplacementCheckin"
ADD COLUMN "vehicleKmSnapshot" INTEGER;