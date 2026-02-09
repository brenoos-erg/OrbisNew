-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('TERMO_RESPONSABILIDADE');

-- CreateEnum
CREATE TYPE "DocumentAssignmentStatus" AS ENUM ('PENDENTE', 'AGUARDANDO_ASSINATURA', 'ASSINADO', 'RECUSADO');

-- AlterEnum
ALTER TYPE "SolicitationStatus" ADD VALUE IF NOT EXISTS 'AGUARDANDO_TERMO';

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "solicitationId" TEXT,
    "type" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAssignment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DocumentAssignmentStatus" NOT NULL DEFAULT 'PENDENTE',
    "signingProvider" TEXT,
    "signingUrl" TEXT,
    "signedAt" TIMESTAMP(3),
    "auditTrailUrl" TEXT,
    "auditTrailHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_solicitationId_idx" ON "Document"("solicitationId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAssignment_documentId_userId_key" ON "DocumentAssignment"("documentId", "userId");

-- CreateIndex
CREATE INDEX "DocumentAssignment_userId_status_idx" ON "DocumentAssignment"("userId", "status");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_solicitationId_fkey" FOREIGN KEY ("solicitationId") REFERENCES "Solicitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAssignment" ADD CONSTRAINT "DocumentAssignment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAssignment" ADD CONSTRAINT "DocumentAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;