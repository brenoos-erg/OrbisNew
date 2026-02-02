-- CreateTable
CREATE TABLE "SolicitacaoSetor" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "constaFlag" TEXT,
    "campos" JSONB,
    "finalizadoEm" TIMESTAMP(3),
    "finalizadoPor" TEXT,

    CONSTRAINT "SolicitacaoSetor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitacaoSetor_solicitacaoId_setor_key" ON "SolicitacaoSetor"("solicitacaoId", "setor");

-- CreateIndex
CREATE INDEX "SolicitacaoSetor_setor_status_idx" ON "SolicitacaoSetor"("setor", "status");

-- AddForeignKey
ALTER TABLE "SolicitacaoSetor" ADD CONSTRAINT "SolicitacaoSetor_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;