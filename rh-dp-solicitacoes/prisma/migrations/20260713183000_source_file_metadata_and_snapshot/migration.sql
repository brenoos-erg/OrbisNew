ALTER TABLE `DocumentVersion`
  ADD COLUMN `sourceOriginalName` VARCHAR(191) NULL,
  ADD COLUMN `sourceMimeType` VARCHAR(191) NULL,
  ADD COLUMN `sourceSizeBytes` BIGINT NULL,
  ADD COLUMN `sourceSha256` VARCHAR(191) NULL;

CREATE TABLE `DocumentSourceApproverSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NOT NULL,
  `flowItemId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `stepType` ENUM('REVIEW', 'QUALITY', 'SIG', 'APPROVAL_GENERIC') NOT NULL,
  `order` INTEGER NOT NULL,
  `policy` VARCHAR(191) NOT NULL DEFAULT 'CURRENT_AND_HISTORICAL',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DocumentSourceApproverSnapshot_versionId_flowItemId_userId_key`(`versionId`, `flowItemId`, `userId`),
  INDEX `DocumentSourceApproverSnapshot_versionId_userId_idx`(`versionId`, `userId`),
  INDEX `DocumentSourceApproverSnapshot_flowItemId_userId_idx`(`flowItemId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DocumentSourceApproverSnapshot` ADD CONSTRAINT `DocumentSourceApproverSnapshot_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentSourceApproverSnapshot` ADD CONSTRAINT `DocumentSourceApproverSnapshot_flowItemId_fkey` FOREIGN KEY (`flowItemId`) REFERENCES `DocumentTypeApprovalFlow`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DocumentSourceApproverSnapshot` ADD CONSTRAINT `DocumentSourceApproverSnapshot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
