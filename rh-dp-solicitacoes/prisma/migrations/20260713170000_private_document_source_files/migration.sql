-- Adds private source-file references and source-file specific audit/permission values.
-- Do not apply to production before running the source-file migration script in dry-run mode.
ALTER TABLE `DocumentVersion` ADD COLUMN `sourceStorageKey` TEXT NULL;

ALTER TABLE `DocumentAuditLog` MODIFY `action` ENUM(
  'VIEW',
  'DOWNLOAD',
  'SOURCE_FILE_VIEWED',
  'SOURCE_FILE_DOWNLOADED',
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
