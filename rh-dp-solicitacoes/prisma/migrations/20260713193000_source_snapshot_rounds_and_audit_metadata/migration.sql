ALTER TABLE `DocumentAuditLog` ADD COLUMN `metadata` JSON NULL;

ALTER TABLE `DocumentAuditLog` MODIFY `action` ENUM(
  'VIEW',
  'DOWNLOAD',
  'SOURCE_FILE_VIEWED',
  'SOURCE_FILE_DOWNLOADED',
  'SOURCE_FILE_INTEGRITY_FAILED',
  'PRINT',
  'TECHNICAL_APPROVED',
  'TECHNICAL_REJECTED',
  'QUALITY_APPROVED',
  'QUALITY_REJECTED',
  'PUBLISHED',
  'CANCEL',
  'DIRECT_PUBLICATION',
  'OBSOLETE',
  'CONTROLLED_COPY_ISSUED',
  'CONTROLLED_COPY_CANCELED'
) NOT NULL;

ALTER TABLE `DocumentSourceApproverSnapshot`
  ADD COLUMN `roundNumber` INTEGER NOT NULL DEFAULT 1,
  MODIFY `policy` ENUM('CURRENT_ONLY', 'CURRENT_AND_HISTORICAL') NOT NULL DEFAULT 'CURRENT_AND_HISTORICAL';

ALTER TABLE `DocumentSourceApproverSnapshot` DROP INDEX `DocumentSourceApproverSnapshot_versionId_flowItemId_userId_key`;
CREATE UNIQUE INDEX `DocumentSourceApproverSnapshot_versionId_flowItemId_userId_roundNumber_key` ON `DocumentSourceApproverSnapshot`(`versionId`, `flowItemId`, `userId`, `roundNumber`);
CREATE INDEX `DocumentSourceApproverSnapshot_versionId_roundNumber_idx` ON `DocumentSourceApproverSnapshot`(`versionId`, `roundNumber`);
