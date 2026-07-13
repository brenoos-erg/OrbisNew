-- Diagnóstico obrigatório antes de qualquer ALTER ENUM em MySQL.
-- Executar manualmente em produção antes de aplicar esta migration:
-- SELECT DISTINCT action FROM DocumentAuditLog;

ALTER TABLE `IsoDocument` ADD COLUMN `currentPublishedVersionId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `IsoDocument_currentPublishedVersionId_key` ON `IsoDocument`(`currentPublishedVersionId`);
ALTER TABLE `IsoDocument` ADD CONSTRAINT `IsoDocument_currentPublishedVersionId_fkey` FOREIGN KEY (`currentPublishedVersionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DocumentTypeApprovalFlow` DROP INDEX `DocumentTypeApprovalFlow_documentTypeId_order_key`;
CREATE INDEX `DocumentTypeApprovalFlow_documentTypeId_order_idx` ON `DocumentTypeApprovalFlow`(`documentTypeId`, `order`);

ALTER TABLE `DocumentApproval` MODIFY `status` ENUM('PENDING','APPROVED','REJECTED','WAIVED') NOT NULL DEFAULT 'PENDING';

CREATE TABLE `DocumentApprovalRound` (
  `id` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NOT NULL,
  `roundNumber` INTEGER NOT NULL,
  `status` ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DocumentApprovalRound_versionId_roundNumber_key` (`versionId`, `roundNumber`),
  INDEX `DocumentApprovalRound_versionId_status_idx` (`versionId`, `status`),
  CONSTRAINT `DocumentApprovalRound_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DocumentApprovalStep` (
  `id` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NOT NULL,
  `roundId` VARCHAR(191) NOT NULL,
  `flowItemId` VARCHAR(191) NOT NULL,
  `order` INTEGER NOT NULL,
  `stepType` ENUM('REVIEW','QUALITY','SIG','APPROVAL_GENERIC') NOT NULL,
  `approvalRule` ENUM('ALL','ANY','MINIMUM') NOT NULL,
  `minimumApprovals` INTEGER NULL,
  `status` ENUM('PENDING','APPROVED','REJECTED','CANCELLED','WAIVED') NOT NULL DEFAULT 'PENDING',
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DocumentApprovalStep_roundId_flowItemId_key` (`roundId`, `flowItemId`),
  INDEX `DocumentApprovalStep_versionId_status_order_idx` (`versionId`, `status`, `order`),
  INDEX `DocumentApprovalStep_roundId_order_idx` (`roundId`, `order`),
  CONSTRAINT `DocumentApprovalStep_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DocumentApprovalStep_roundId_fkey` FOREIGN KEY (`roundId`) REFERENCES `DocumentApprovalRound`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DocumentApprovalStep_flowItemId_fkey` FOREIGN KEY (`flowItemId`) REFERENCES `DocumentTypeApprovalFlow`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DocumentApprovalDecision` (
  `id` VARCHAR(191) NOT NULL,
  `stepId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING','APPROVED','REJECTED','WAIVED') NOT NULL DEFAULT 'PENDING',
  `decidedAt` DATETIME(3) NULL,
  `comment` LONGTEXT NULL,
  `required` BOOLEAN NOT NULL DEFAULT true,
  `waivedAt` DATETIME(3) NULL,
  `waivedById` VARCHAR(191) NULL,
  `waiveReason` LONGTEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DocumentApprovalDecision_stepId_userId_key` (`stepId`, `userId`),
  INDEX `DocumentApprovalDecision_userId_status_idx` (`userId`, `status`),
  CONSTRAINT `DocumentApprovalDecision_stepId_fkey` FOREIGN KEY (`stepId`) REFERENCES `DocumentApprovalStep`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DocumentApprovalDecision_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `DocumentApprovalDecision_waivedById_fkey` FOREIGN KEY (`waivedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DocumentQualityChecklist` (
  `id` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NOT NULL,
  `reviewerUserId` VARCHAR(191) NOT NULL,
  `completedAt` DATETIME(3) NULL,
  `result` ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `notes` LONGTEXT NULL,
  `items` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `DocumentQualityChecklist_versionId_completedAt_idx` (`versionId`, `completedAt`),
  INDEX `DocumentQualityChecklist_reviewerUserId_idx` (`reviewerUserId`),
  CONSTRAINT `DocumentQualityChecklist_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DocumentQualityChecklist_reviewerUserId_fkey` FOREIGN KEY (`reviewerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DocumentSegregationException` (
  `id` VARCHAR(191) NOT NULL,
  `documentId` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NOT NULL,
  `conflictType` ENUM('SELF_TECHNICAL_APPROVAL','SELF_QUALITY_APPROVAL','SELF_PUBLICATION','TECHNICAL_AND_QUALITY_APPROVER','AUTHOR_AND_DOCUMENT_MANAGER','APPROVER_AND_POSTING_ERROR_DELETER') NOT NULL,
  `requestedById` VARCHAR(191) NOT NULL,
  `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `justification` LONGTEXT NOT NULL,
  `status` ENUM('PENDING','APPROVED','REJECTED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  `decidedById` VARCHAR(191) NULL,
  `decidedAt` DATETIME(3) NULL,
  `decisionReason` LONGTEXT NULL,
  PRIMARY KEY (`id`),
  INDEX `DocumentSegregationException_versionId_conflictType_status_idx` (`versionId`, `conflictType`, `status`),
  INDEX `DocumentSegregationException_documentId_status_idx` (`documentId`, `status`),
  CONSTRAINT `DocumentSegregationException_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `IsoDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DocumentSegregationException_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DocumentSegregationException_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `DocumentSegregationException_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DocumentNotificationRule` MODIFY `event` ENUM('DOCUMENT_CREATED','DOCUMENT_SUBMITTED_FOR_APPROVAL','DOCUMENT_APPROVED','DOCUMENT_REJECTED','DOCUMENT_CANCELLED','DOCUMENT_QUALITY_REVIEW','DOCUMENT_PUBLISHED','DOCUMENT_REVISED','DOCUMENT_DISTRIBUTED','DOCUMENT_EXPIRING','DOCUMENT_EXPIRED') NOT NULL;
ALTER TABLE `DocumentNotificationLog` MODIFY `event` ENUM('DOCUMENT_CREATED','DOCUMENT_SUBMITTED_FOR_APPROVAL','DOCUMENT_APPROVED','DOCUMENT_REJECTED','DOCUMENT_CANCELLED','DOCUMENT_QUALITY_REVIEW','DOCUMENT_PUBLISHED','DOCUMENT_REVISED','DOCUMENT_DISTRIBUTED','DOCUMENT_EXPIRING','DOCUMENT_EXPIRED') NOT NULL;

UPDATE `IsoDocument` d
SET `currentPublishedVersionId` = (
  SELECT v.`id` FROM `DocumentVersion` v
  WHERE v.`documentId` = d.`id` AND v.`isCurrentPublished` = true AND v.`status` = 'PUBLICADO'
  ORDER BY v.`publishedAt` DESC, v.`createdAt` DESC
  LIMIT 1
)
WHERE `currentPublishedVersionId` IS NULL;
