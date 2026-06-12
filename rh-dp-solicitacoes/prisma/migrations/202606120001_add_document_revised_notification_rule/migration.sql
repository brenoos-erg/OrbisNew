ALTER TABLE `DocumentNotificationRule`
  MODIFY COLUMN `event` ENUM('DOCUMENT_CREATED','DOCUMENT_SUBMITTED_FOR_APPROVAL','DOCUMENT_APPROVED','DOCUMENT_REJECTED','DOCUMENT_QUALITY_REVIEW','DOCUMENT_PUBLISHED','DOCUMENT_REVISED','DOCUMENT_DISTRIBUTED','DOCUMENT_EXPIRING','DOCUMENT_EXPIRED') NOT NULL;

ALTER TABLE `DocumentNotificationLog`
  MODIFY COLUMN `event` ENUM('DOCUMENT_CREATED','DOCUMENT_SUBMITTED_FOR_APPROVAL','DOCUMENT_APPROVED','DOCUMENT_REJECTED','DOCUMENT_QUALITY_REVIEW','DOCUMENT_PUBLISHED','DOCUMENT_REVISED','DOCUMENT_DISTRIBUTED','DOCUMENT_EXPIRING','DOCUMENT_EXPIRED') NOT NULL;

INSERT INTO `DocumentNotificationRule` (
  `id`,
  `event`,
  `documentTypeId`,
  `flowItemId`,
  `enabled`,
  `notifyAuthor`,
  `notifyApproverGroup`,
  `notifyQualityReviewers`,
  `notifyOwnerDepartment`,
  `notifyOwnerCostCenter`,
  `notifyDistributionTargets`,
  `fixedEmailsJson`,
  `ccEmailsJson`,
  `subjectTemplate`,
  `bodyTemplate`,
  `createdAt`,
  `updatedAt`
)
SELECT
  UUID(),
  'DOCUMENT_PUBLISHED',
  NULL,
  NULL,
  true,
  true,
  false,
  false,
  true,
  true,
  true,
  JSON_ARRAY(),
  JSON_ARRAY(),
  '[{documentCode}] Documento publicado',
  'O documento {documentCode} - {documentTitle} ({revisionNumber}) foi publicado em {publishedAt}. Link: {link}',
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `DocumentNotificationRule`
  WHERE `event` = 'DOCUMENT_PUBLISHED'
    AND `documentTypeId` IS NULL
    AND `flowItemId` IS NULL
);

INSERT INTO `DocumentNotificationRule` (
  `id`,
  `event`,
  `documentTypeId`,
  `flowItemId`,
  `enabled`,
  `notifyAuthor`,
  `notifyApproverGroup`,
  `notifyQualityReviewers`,
  `notifyOwnerDepartment`,
  `notifyOwnerCostCenter`,
  `notifyDistributionTargets`,
  `fixedEmailsJson`,
  `ccEmailsJson`,
  `subjectTemplate`,
  `bodyTemplate`,
  `createdAt`,
  `updatedAt`
)
SELECT
  UUID(),
  'DOCUMENT_REVISED',
  NULL,
  NULL,
  true,
  true,
  false,
  false,
  true,
  true,
  true,
  JSON_ARRAY(),
  JSON_ARRAY(),
  '[{documentCode}] Revisão publicada ({revisionNumber})',
  'A revisão {revisionNumber} do documento {documentCode} - {documentTitle} foi publicada e está vigente desde {publishedAt}. Link: {link}',
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `DocumentNotificationRule`
  WHERE `event` = 'DOCUMENT_REVISED'
    AND `documentTypeId` IS NULL
    AND `flowItemId` IS NULL
);
