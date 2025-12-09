-- AlterTable
ALTER TABLE "Position" ADD COLUMN     "behavioralCompetencies" TEXT,
ADD COLUMN     "complementaryActivities" TEXT,
ADD COLUMN     "course" TEXT,
ADD COLUMN     "courseInProgress" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "enxoval" TEXT,
ADD COLUMN     "experience" TEXT,
ADD COLUMN     "mainActivities" TEXT,
ADD COLUMN     "others" TEXT,
ADD COLUMN     "periodModule" TEXT,
ADD COLUMN     "requiredKnowledge" TEXT,
ADD COLUMN     "schooling" TEXT,
ADD COLUMN     "schoolingCompleted" TEXT,
ADD COLUMN     "sectorProject" TEXT,
ADD COLUMN     "site" TEXT,
ADD COLUMN     "uniform" TEXT,
ADD COLUMN     "workPoint" TEXT,
ADD COLUMN     "workSchedule" TEXT,
ADD COLUMN     "workplace" TEXT;

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "model" TEXT,
    "costCenter" TEXT,
    "sector" TEXT,
    "kmCurrent" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DISPONIVEL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCheckin" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "costCenter" TEXT,
    "sectorActivity" TEXT,
    "driverName" TEXT NOT NULL,
    "vehiclePlateSnapshot" TEXT NOT NULL,
    "vehicleTypeSnapshot" TEXT NOT NULL,
    "kmAtInspection" INTEGER NOT NULL,
    "checklistJson" JSONB NOT NULL,
    "fatigueJson" JSONB NOT NULL,
    "fatigueScore" INTEGER NOT NULL,
    "fatigueRisk" TEXT NOT NULL,
    "driverStatus" TEXT NOT NULL,
    "hasNonConformity" BOOLEAN NOT NULL,
    "nonConformityCriticality" TEXT,
    "nonConformityActions" TEXT,
    "nonConformityManager" TEXT,
    "nonConformityDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCheckin" ADD CONSTRAINT "VehicleCheckin_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCheckin" ADD CONSTRAINT "VehicleCheckin_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
