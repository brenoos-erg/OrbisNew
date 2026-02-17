-- Ensure NonConformityCauseItem exists in environments where previous migrations partially applied.

CREATE TABLE IF NOT EXISTS `NonConformityCauseItem` (
  `id` VARCHAR(191) NOT NULL,
  `nonConformityId` VARCHAR(191) NOT NULL,
  `ordem` INTEGER NOT NULL,
  `pergunta` VARCHAR(191) NOT NULL,
  `resposta` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'NonConformityCauseItem'
    AND INDEX_NAME = 'NonConformityCauseItem_nonConformityId_ordem_idx'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX `NonConformityCauseItem_nonConformityId_ordem_idx` ON `NonConformityCauseItem`(`nonConformityId`, `ordem`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'NonConformityCauseItem'
    AND CONSTRAINT_NAME = 'NonConformityCauseItem_nonConformityId_fkey'
);
SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE `NonConformityCauseItem` ADD CONSTRAINT `NonConformityCauseItem_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
