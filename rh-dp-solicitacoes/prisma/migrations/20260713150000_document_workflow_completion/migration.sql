-- Diagnostic required before applying enum changes:
-- SELECT DISTINCT action FROM DocumentAuditLog;

ALTER TABLE `DocumentRoleAssignment` DROP INDEX `DocumentRoleAssignment_active_scope_unique`;
CREATE UNIQUE INDEX `DocumentRoleAssignment_scope_unique` ON `DocumentRoleAssignment`(`userId`, `role`, `scopeType`, `scopeKey`);

ALTER TABLE `DocumentTypeApprovalFlow` ADD COLUMN `approvalRule` ENUM('ALL','ANY','MINIMUM') NOT NULL DEFAULT 'ALL';
ALTER TABLE `DocumentTypeApprovalFlow` ADD COLUMN `minimumApprovals` INTEGER NULL;

ALTER TABLE `DocumentVersion` ADD COLUMN `sourceFileUrl` TEXT NULL;
ALTER TABLE `DocumentVersion` ADD COLUMN `publishedFileUrl` TEXT NULL;
ALTER TABLE `DocumentVersion` ADD COLUMN `cancelledAt` DATETIME(3) NULL;
ALTER TABLE `DocumentVersion` ADD COLUMN `cancelledById` VARCHAR(191) NULL;
ALTER TABLE `DocumentVersion` ADD COLUMN `cancelReason` LONGTEXT NULL;
ALTER TABLE `DocumentVersion` ADD COLUMN `replacementDocumentId` VARCHAR(191) NULL;
ALTER TABLE `DocumentVersion` ADD CONSTRAINT `DocumentVersion_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DocumentVersion` ADD CONSTRAINT `DocumentVersion_replacementDocumentId_fkey` FOREIGN KEY (`replacementDocumentId`) REFERENCES `IsoDocument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DocumentAuditLog` MODIFY `action` ENUM('VIEW','DOWNLOAD','PRINT','TECHNICAL_APPROVED','TECHNICAL_REJECTED','QUALITY_APPROVED','QUALITY_REJECTED','PUBLISHED','CANCEL','DIRECT_PUBLICATION','OBSOLETE','CONTROLLED_COPY_ISSUED','CONTROLLED_COPY_CANCELED') NOT NULL;
