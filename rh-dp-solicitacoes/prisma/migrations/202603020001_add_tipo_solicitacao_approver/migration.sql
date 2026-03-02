CREATE TABLE `TipoSolicitacaoApprover` (
  `id` VARCHAR(191) NOT NULL,
  `tipoId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `TipoSolicitacaoApprover_tipoId_userId_key`(`tipoId`, `userId`),
  INDEX `TipoSolicitacaoApprover_tipoId_idx`(`tipoId`),
  INDEX `TipoSolicitacaoApprover_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TipoSolicitacaoApprover`
  ADD CONSTRAINT `TipoSolicitacaoApprover_tipoId_fkey`
  FOREIGN KEY (`tipoId`) REFERENCES `TipoSolicitacao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `TipoSolicitacaoApprover`
  ADD CONSTRAINT `TipoSolicitacaoApprover_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;