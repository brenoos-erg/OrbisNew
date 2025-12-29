-- CreateEnum
CREATE TYPE "RefusalStatus" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

-- CreateTable
CREATE TABLE "RefusalReport" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "sectorOrContract" TEXT NOT NULL,
    "riskSituation" TEXT NOT NULL,
    "locationOrEquipment" TEXT NOT NULL,
    "detailedCondition" TEXT NOT NULL,
    "contractManagerName" TEXT,
    "generalCoordinatorName" TEXT,
    "contractManagerId" TEXT,
    "generalCoordinatorId" TEXT,
    "status" "RefusalStatus" NOT NULL DEFAULT 'PENDENTE',
    "decision" BOOLEAN,
    "decisionComment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decisionLevel" "ModuleLevel",

    CONSTRAINT "RefusalReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefusalAttachment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefusalAttachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RefusalReport" ADD CONSTRAINT "RefusalReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefusalReport" ADD CONSTRAINT "RefusalReport_contractManagerId_fkey" FOREIGN KEY ("contractManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefusalReport" ADD CONSTRAINT "RefusalReport_generalCoordinatorId_fkey" FOREIGN KEY ("generalCoordinatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefusalReport" ADD CONSTRAINT "RefusalReport_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefusalAttachment" ADD CONSTRAINT "RefusalAttachment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "RefusalReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;