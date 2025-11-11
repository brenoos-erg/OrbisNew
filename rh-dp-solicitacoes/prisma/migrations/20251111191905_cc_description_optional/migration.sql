/*
  Warnings:

  - You are about to drop the column `name` on the `CostCenter` table. All the data in the column will be lost.
  - You are about to drop the column `login` on the `Leader` table. All the data in the column will be lost.
  - You are about to drop the column `costCenter` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `CostCenter` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CCStatus" AS ENUM ('ATIVADO', 'INATIVO');

-- DropIndex
DROP INDEX "CostCenter_name_key";

-- DropIndex
DROP INDEX "Leader_login_key";

-- AlterTable
ALTER TABLE "CostCenter" DROP COLUMN "name",
ADD COLUMN     "abbreviation" TEXT,
ADD COLUMN     "area" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "externalCode" TEXT,
ADD COLUMN     "groupName" TEXT,
ADD COLUMN     "managementType" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "status" "CCStatus" NOT NULL DEFAULT 'ATIVADO',
ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;

-- AlterTable
ALTER TABLE "Leader" DROP COLUMN "login",
ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "costCenter",
DROP COLUMN "position",
ADD COLUMN     "costCenterId" TEXT,
ADD COLUMN     "positionId" TEXT;

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Position_name_key" ON "Position"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_code_key" ON "CostCenter"("code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;
