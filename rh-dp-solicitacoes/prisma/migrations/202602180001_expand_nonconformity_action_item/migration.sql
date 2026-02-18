-- AlterTable
ALTER TABLE `NonConformityActionItem`
  ADD COLUMN `motivoBeneficio` LONGTEXT NULL,
  ADD COLUMN `atividadeComo` LONGTEXT NULL,
  ADD COLUMN `centroImpactadoId` VARCHAR(191) NULL,
  ADD COLUMN `centroImpactadoDescricao` VARCHAR(191) NULL,
  ADD COLUMN `centroResponsavelId` VARCHAR(191) NULL,
  ADD COLUMN `dataInicioPrevista` DATETIME(3) NULL,
  ADD COLUMN `dataFimPrevista` DATETIME(3) NULL,
  ADD COLUMN `custo` DECIMAL(12,2) NULL,
  ADD COLUMN `dataConclusao` DATETIME(3) NULL,
  ADD COLUMN `tipo` ENUM('ACAO_CORRETIVA', 'ACAO_PREVENTIVA', 'MELHORIAS', 'OUTROS') NOT NULL DEFAULT 'ACAO_CORRETIVA',
  ADD COLUMN `origem` VARCHAR(80) NULL,
  ADD COLUMN `referencia` VARCHAR(120) NULL,
  ADD COLUMN `rapidez` INTEGER NULL,
  ADD COLUMN `autonomia` INTEGER NULL,
  ADD COLUMN `beneficio` INTEGER NULL;

-- CreateIndex
CREATE INDEX `NonConformityActionItem_centroImpactadoId_idx` ON `NonConformityActionItem`(`centroImpactadoId`);
CREATE INDEX `NonConformityActionItem_centroResponsavelId_idx` ON `NonConformityActionItem`(`centroResponsavelId`);

-- AddForeignKey
ALTER TABLE `NonConformityActionItem` ADD CONSTRAINT `NonConformityActionItem_centroImpactadoId_fkey` FOREIGN KEY (`centroImpactadoId`) REFERENCES `CostCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `NonConformityActionItem` ADD CONSTRAINT `NonConformityActionItem_centroResponsavelId_fkey` FOREIGN KEY (`centroResponsavelId`) REFERENCES `CostCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;