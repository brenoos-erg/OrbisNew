-- CreateTable
CREATE TABLE `DocumentAuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `documentId` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `action` ENUM('VIEW', 'DOWNLOAD', 'PRINT') NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ip` VARCHAR(191) NULL,
  `userAgent` VARCHAR(191) NULL,

  INDEX `DocumentAuditLog_documentId_createdAt_idx`(`documentId`, `createdAt`),
  INDEX `DocumentAuditLog_versionId_createdAt_idx`(`versionId`, `createdAt`),
  INDEX `DocumentAuditLog_action_createdAt_idx`(`action`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DocumentAuditLog` ADD CONSTRAINT `DocumentAuditLog_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `IsoDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentAuditLog` ADD CONSTRAINT `DocumentAuditLog_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentAuditLog` ADD CONSTRAINT `DocumentAuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;