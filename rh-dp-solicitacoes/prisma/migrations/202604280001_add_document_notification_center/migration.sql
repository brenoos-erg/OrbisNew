CREATE TABLE `DocumentNotificationRule` (
  `id` VARCHAR(191) NOT NULL,
  `event` ENUM('DOCUMENT_CREATED','DOCUMENT_SUBMITTED_FOR_APPROVAL','DOCUMENT_APPROVED','DOCUMENT_REJECTED','DOCUMENT_QUALITY_REVIEW','DOCUMENT_PUBLISHED','DOCUMENT_DISTRIBUTED','DOCUMENT_EXPIRING','DOCUMENT_EXPIRED') NOT NULL,
  `documentTypeId` VARCHAR(191) NULL,
  `flowItemId` VARCHAR(191) NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `notifyAuthor` BOOLEAN NOT NULL DEFAULT true,
  `notifyApproverGroup` BOOLEAN NOT NULL DEFAULT false,
  `notifyQualityReviewers` BOOLEAN NOT NULL DEFAULT false,
  `notifyOwnerDepartment` BOOLEAN NOT NULL DEFAULT false,
  `notifyOwnerCostCenter` BOOLEAN NOT NULL DEFAULT false,
  `notifyDistributionTargets` BOOLEAN NOT NULL DEFAULT false,
  `fixedEmailsJson` JSON NULL,
  `ccEmailsJson` JSON NULL,
  `subjectTemplate` VARCHAR(191) NOT NULL,
  `bodyTemplate` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `DocumentNotificationRule_event_enabled_idx`(`event`, `enabled`),
  INDEX `DocumentNotificationRule_documentTypeId_flowItemId_idx`(`documentTypeId`, `flowItemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DocumentNotificationLog` (
  `id` VARCHAR(191) NOT NULL,
  `documentId` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NULL,
  `event` ENUM('DOCUMENT_CREATED','DOCUMENT_SUBMITTED_FOR_APPROVAL','DOCUMENT_APPROVED','DOCUMENT_REJECTED','DOCUMENT_QUALITY_REVIEW','DOCUMENT_PUBLISHED','DOCUMENT_DISTRIBUTED','DOCUMENT_EXPIRING','DOCUMENT_EXPIRED') NOT NULL,
  `ruleId` VARCHAR(191) NULL,
  `recipientEmail` VARCHAR(191) NOT NULL,
  `recipientUserId` VARCHAR(191) NULL,
  `recipientOrigin` ENUM('author','approverGroup','qualityReviewers','ownerDepartment','ownerCostCenter','distributionTargets','fixedEmails') NOT NULL,
  `status` ENUM('SENT','FAILED','SKIPPED') NOT NULL,
  `error` LONGTEXT NULL,
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `DocumentNotificationLog_documentId_createdAt_idx`(`documentId`, `createdAt`),
  INDEX `DocumentNotificationLog_versionId_createdAt_idx`(`versionId`, `createdAt`),
  INDEX `DocumentNotificationLog_event_status_createdAt_idx`(`event`, `status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DocumentNotificationRule`
  ADD CONSTRAINT `DocumentNotificationRule_documentTypeId_fkey`
  FOREIGN KEY (`documentTypeId`) REFERENCES `DocumentTypeCatalog`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `DocumentNotificationRule_flowItemId_fkey`
  FOREIGN KEY (`flowItemId`) REFERENCES `DocumentTypeApprovalFlow`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DocumentNotificationLog`
  ADD CONSTRAINT `DocumentNotificationLog_documentId_fkey`
  FOREIGN KEY (`documentId`) REFERENCES `IsoDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `DocumentNotificationLog_versionId_fkey`
  FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `DocumentNotificationLog_ruleId_fkey`
  FOREIGN KEY (`ruleId`) REFERENCES `DocumentNotificationRule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `DocumentNotificationLog_recipientUserId_fkey`
  FOREIGN KEY (`recipientUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
