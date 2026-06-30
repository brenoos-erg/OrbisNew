ALTER TABLE `Position`
  ADD COLUMN `indexador` VARCHAR(191) NULL,
  ADD COLUMN `revision` VARCHAR(191) NULL,
  ADD COLUMN `documentDate` DATETIME(3) NULL,
  ADD COLUMN `managerPosition` VARCHAR(191) NULL,
  ADD COLUMN `framing` VARCHAR(191) NULL,
  ADD COLUMN `areaSector` VARCHAR(191) NULL,
  ADD COLUMN `cbo` VARCHAR(191) NULL,
  ADD COLUMN `summary` LONGTEXT NULL,
  ADD COLUMN `detailedDescription` LONGTEXT NULL,
  ADD COLUMN `necessaryKnowledge` LONGTEXT NULL,
  ADD COLUMN `desiredKnowledge` LONGTEXT NULL,
  ADD COLUMN `humanCompetencies` LONGTEXT NULL,
  ADD COLUMN `functionalCompetencies` LONGTEXT NULL,
  ADD COLUMN `otherCompetencies` LONGTEXT NULL,
  ADD COLUMN `complexity` VARCHAR(191) NULL,
  ADD COLUMN `managementScope` LONGTEXT NULL,
  ADD COLUMN `confidentialDataAccess` VARCHAR(191) NULL,
  ADD COLUMN `responsibilities` LONGTEXT NULL,
  ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `latestDocumentId` VARCHAR(191) NULL;

CREATE TABLE `PositionDocument` (
  `id` VARCHAR(191) NOT NULL,
  `positionId` VARCHAR(191) NOT NULL,
  `originalFilename` VARCHAR(191) NOT NULL,
  `storedFilename` VARCHAR(191) NOT NULL,
  `fileUrl` TEXT NOT NULL,
  `mimeType` VARCHAR(191) NULL,
  `sizeBytes` INTEGER NULL,
  `uploadedById` VARCHAR(191) NOT NULL,
  `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `parsedText` LONGTEXT NULL,
  `extractedJson` JSON NULL,
  `indexador` VARCHAR(191) NULL,
  `revision` VARCHAR(191) NULL,
  `documentDate` DATETIME(3) NULL,
  `isCurrent` BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `PositionDocument_positionId_uploadedAt_idx` ON `PositionDocument`(`positionId`, `uploadedAt`);
CREATE INDEX `PositionDocument_indexador_idx` ON `PositionDocument`(`indexador`);
ALTER TABLE `PositionDocument` ADD CONSTRAINT `PositionDocument_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `Position`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PositionDocument` ADD CONSTRAINT `PositionDocument_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
