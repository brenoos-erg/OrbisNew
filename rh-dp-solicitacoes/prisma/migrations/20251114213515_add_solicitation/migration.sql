/*
  Warnings:

  - You are about to drop the column `autorId` on the `Solicitation` table. All the data in the column will be lost.
  - You are about to drop the column `responsavelId` on the `Solicitation` table. All the data in the column will be lost.
  - You are about to drop the column `setorDestino` on the `Solicitation` table. All the data in the column will be lost.
  - The `status` column on the `Solicitation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[protocolo]` on the table `Solicitation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `costCenterId` to the `Solicitation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departmentId` to the `Solicitation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `protocolo` to the `Solicitation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `solicitanteId` to the `Solicitation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('NAO_PRECISA', 'PENDENTE', 'APROVADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "SolicitationStatus" AS ENUM ('ABERTA', 'EM_ATENDIMENTO', 'AGUARDANDO_APROVACAO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "SolicitationPriority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- DropForeignKey
ALTER TABLE "Solicitation" DROP CONSTRAINT "Solicitation_autorId_fkey";

-- DropForeignKey
ALTER TABLE "Solicitation" DROP CONSTRAINT "Solicitation_responsavelId_fkey";

-- AlterTable
ALTER TABLE "Solicitation" DROP COLUMN "autorId",
DROP COLUMN "responsavelId",
DROP COLUMN "setorDestino",
ADD COLUMN     "approvalAt" TIMESTAMP(3),
ADD COLUMN     "approvalComment" TEXT,
ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NAO_PRECISA',
ADD COLUMN     "approverId" TEXT,
ADD COLUMN     "costCenterId" TEXT NOT NULL,
ADD COLUMN     "dataAbertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dataCancelamento" TIMESTAMP(3),
ADD COLUMN     "dataFechamento" TIMESTAMP(3),
ADD COLUMN     "dataPrevista" TIMESTAMP(3),
ADD COLUMN     "departmentId" TEXT NOT NULL,
ADD COLUMN     "prioridade" "SolicitationPriority",
ADD COLUMN     "protocolo" TEXT NOT NULL,
ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "solicitanteId" TEXT NOT NULL,
ALTER COLUMN "descricao" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "SolicitationStatus" NOT NULL DEFAULT 'ABERTA';

-- CreateIndex
CREATE UNIQUE INDEX "Solicitation_protocolo_key" ON "Solicitation"("protocolo");

-- AddForeignKey
ALTER TABLE "Solicitation" ADD CONSTRAINT "Solicitation_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitation" ADD CONSTRAINT "Solicitation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitation" ADD CONSTRAINT "Solicitation_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitation" ADD CONSTRAINT "Solicitation_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
