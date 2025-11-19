-- AlterTable
ALTER TABLE "Solicitation"
ADD COLUMN "assumidaPorId" TEXT,
ADD COLUMN "assumidaEm" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Solicitation"
ADD CONSTRAINT "Solicitation_assumidaPorId_fkey"
FOREIGN KEY ("assumidaPorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
