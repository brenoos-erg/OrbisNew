-- CreateTable
CREATE TABLE "SolicitationTimeline" (
    "id" TEXT NOT NULL,
    "solicitationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitationTimeline_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SolicitationTimeline" ADD CONSTRAINT "SolicitationTimeline_solicitationId_fkey" FOREIGN KEY ("solicitationId") REFERENCES "Solicitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
