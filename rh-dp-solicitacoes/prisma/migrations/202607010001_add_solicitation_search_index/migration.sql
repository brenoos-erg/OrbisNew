CREATE TABLE `SolicitationSearchIndex` (
  `id` VARCHAR(191) NOT NULL,
  `solicitationId` VARCHAR(191) NOT NULL,
  `searchText` LONGTEXT NOT NULL,
  `protocolo` VARCHAR(191) NULL,
  `tipoId` VARCHAR(191) NULL,
  `status` VARCHAR(191) NULL,
  `departmentId` VARCHAR(191) NULL,
  `costCenterId` VARCHAR(191) NULL,
  `solicitanteId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `SolicitationSearchIndex_solicitationId_key`(`solicitationId`),
  INDEX `SolicitationSearchIndex_tipoId_idx`(`tipoId`),
  INDEX `SolicitationSearchIndex_status_idx`(`status`),
  INDEX `SolicitationSearchIndex_departmentId_idx`(`departmentId`),
  INDEX `SolicitationSearchIndex_costCenterId_idx`(`costCenterId`),
  INDEX `SolicitationSearchIndex_solicitanteId_idx`(`solicitanteId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SolicitationSearchIndex`
  ADD CONSTRAINT `SolicitationSearchIndex_solicitationId_fkey`
  FOREIGN KEY (`solicitationId`) REFERENCES `Solicitation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
