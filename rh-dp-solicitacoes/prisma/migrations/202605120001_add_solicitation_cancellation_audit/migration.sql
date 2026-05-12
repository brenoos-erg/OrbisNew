ALTER TABLE `Solicitation`
  ADD COLUMN `cancelamentoStatus` VARCHAR(32) NULL,
  ADD COLUMN `cancelamentoSolicitadoPorId` VARCHAR(191) NULL,
  ADD COLUMN `cancelamentoSolicitadoEm` DATETIME(3) NULL,
  ADD COLUMN `cancelamentoMotivo` TEXT NULL,
  ADD COLUMN `cancelamentoAnalisadoPorId` VARCHAR(191) NULL,
  ADD COLUMN `cancelamentoAnalisadoEm` DATETIME(3) NULL,
  ADD COLUMN `cancelamentoJustificativaAnalise` TEXT NULL,
  ADD COLUMN `cancelamentoOrigem` VARCHAR(32) NULL;

CREATE INDEX `Solicitation_cancelamentoStatus_idx` ON `Solicitation`(`cancelamentoStatus`);
CREATE INDEX `Solicitation_cancelamentoSolicitadoPorId_idx` ON `Solicitation`(`cancelamentoSolicitadoPorId`);
CREATE INDEX `Solicitation_cancelamentoAnalisadoPorId_idx` ON `Solicitation`(`cancelamentoAnalisadoPorId`);
