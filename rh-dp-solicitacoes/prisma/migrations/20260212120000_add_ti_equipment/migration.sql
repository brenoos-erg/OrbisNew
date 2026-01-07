-- Create Enums
CREATE TYPE "TiEquipmentCategory" AS ENUM ('LINHA_TELEFONICA', 'SMARTPHONE', 'NOTEBOOK', 'DESKTOP', 'MONITOR', 'IMPRESSORA', 'TPLINK', 'OUTROS');

CREATE TYPE "TiEquipmentStatus" AS ENUM ('IN_STOCK', 'ASSIGNED', 'MAINTENANCE', 'RETIRED');

-- Create Table
CREATE TABLE "TiEquipment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "patrimonio" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" NUMERIC(14,2),
    "costCenterIdSnapshot" TEXT,
    "serialNumber" TEXT,
    "category" "TiEquipmentCategory" NOT NULL,
    "status" "TiEquipmentStatus" NOT NULL DEFAULT 'IN_STOCK',
    "observations" TEXT,

    CONSTRAINT "TiEquipment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TiEquipment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TiEquipment_costCenterIdSnapshot_fkey" FOREIGN KEY ("costCenterIdSnapshot") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Indexes & Constraints
CREATE UNIQUE INDEX "TiEquipment_patrimonio_key" ON "TiEquipment"("patrimonio");
CREATE UNIQUE INDEX "TiEquipment_serialNumber_key" ON "TiEquipment"("serialNumber");
CREATE INDEX "TiEquipment_category_status_idx" ON "TiEquipment"("category", "status");