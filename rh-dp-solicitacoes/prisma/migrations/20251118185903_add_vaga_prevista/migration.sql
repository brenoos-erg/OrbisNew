-- AlterTable
ALTER TABLE "Solicitation" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "vagaPrevista" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Solicitation" ADD CONSTRAINT "Solicitation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Solicitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
