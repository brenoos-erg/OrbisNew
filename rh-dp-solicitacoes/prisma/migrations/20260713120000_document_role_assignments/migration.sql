-- Adds scoped SGI document roles without altering legacy approver controls.
CREATE TABLE `DocumentRoleAssignment` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `role` ENUM('DOCUMENT_VIEWER','DOCUMENT_AUTHOR','DOCUMENT_REVIEWER','TECHNICAL_APPROVER','QUALITY_REVIEWER','DOCUMENT_PUBLISHER','DOCUMENT_MANAGER','DOCUMENT_AUDITOR','EXTERNAL_DOCUMENT_MANAGER') NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `scopeType` ENUM('GLOBAL','DEPARTMENT','COST_CENTER','DOCUMENT_TYPE','DOCUMENT_FAMILY','DOCUMENT','APPROVER_GROUP') NOT NULL DEFAULT 'GLOBAL',
  `scopeKey` VARCHAR(191) NOT NULL DEFAULT 'GLOBAL',
  `departmentId` VARCHAR(191) NULL,
  `costCenterId` VARCHAR(191) NULL,
  `documentTypeId` VARCHAR(191) NULL,
  `documentFamily` VARCHAR(191) NULL,
  `documentId` VARCHAR(191) NULL,
  `approverGroupId` VARCHAR(191) NULL,
  `validFrom` DATETIME(3) NULL,
  `validUntil` DATETIME(3) NULL,
  `substituteForUserId` VARCHAR(191) NULL,
  `temporaryReason` LONGTEXT NULL,
  `justification` LONGTEXT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedById` VARCHAR(191) NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  `disabledAt` DATETIME(3) NULL,
  `disabledById` VARCHAR(191) NULL,
  `disableReason` LONGTEXT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DocumentRoleAuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `assignmentId` VARCHAR(191) NULL,
  `targetUserId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `action` ENUM('DOCUMENT_ROLE_ASSIGNED','DOCUMENT_ROLE_UPDATED','DOCUMENT_ROLE_DISABLED','DOCUMENT_ROLE_REACTIVATED','DOCUMENT_SCOPE_CHANGED','DOCUMENT_VALIDITY_CHANGED','SEGREGATION_CONFLICT_DETECTED','SEGREGATION_EXCEPTION_APPROVED') NOT NULL,
  `roleBefore` ENUM('DOCUMENT_VIEWER','DOCUMENT_AUTHOR','DOCUMENT_REVIEWER','TECHNICAL_APPROVER','QUALITY_REVIEWER','DOCUMENT_PUBLISHER','DOCUMENT_MANAGER','DOCUMENT_AUDITOR','EXTERNAL_DOCUMENT_MANAGER') NULL,
  `roleAfter` ENUM('DOCUMENT_VIEWER','DOCUMENT_AUTHOR','DOCUMENT_REVIEWER','TECHNICAL_APPROVER','QUALITY_REVIEWER','DOCUMENT_PUBLISHER','DOCUMENT_MANAGER','DOCUMENT_AUDITOR','EXTERNAL_DOCUMENT_MANAGER') NULL,
  `permissionsBefore` JSON NULL,
  `permissionsAfter` JSON NULL,
  `scopeBefore` JSON NULL,
  `scopeAfter` JSON NULL,
  `validFromBefore` DATETIME(3) NULL,
  `validFromAfter` DATETIME(3) NULL,
  `validUntilBefore` DATETIME(3) NULL,
  `validUntilAfter` DATETIME(3) NULL,
  `justification` LONGTEXT NULL,
  `conflictType` ENUM('SELF_TECHNICAL_APPROVAL','SELF_QUALITY_APPROVAL','SELF_PUBLICATION','TECHNICAL_AND_QUALITY_APPROVER','AUTHOR_AND_DOCUMENT_MANAGER','APPROVER_AND_POSTING_ERROR_DELETER') NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `DocumentRoleAssignment_active_scope_unique` ON `DocumentRoleAssignment`(`userId`, `role`, `scopeType`, `scopeKey`, `active`);
CREATE INDEX `DocumentRoleAssignment_userId_role_active_idx` ON `DocumentRoleAssignment`(`userId`, `role`, `active`);
CREATE INDEX `DocumentRoleAssignment_scopeType_scopeKey_idx` ON `DocumentRoleAssignment`(`scopeType`, `scopeKey`);
CREATE INDEX `DocumentRoleAssignment_scopeType_departmentId_costCenterId_documentTypeId_documentId_approverGroupId_idx` ON `DocumentRoleAssignment`(`scopeType`, `departmentId`, `costCenterId`, `documentTypeId`, `documentId`, `approverGroupId`);
CREATE INDEX `DocumentRoleAssignment_validUntil_active_idx` ON `DocumentRoleAssignment`(`validUntil`, `active`);
CREATE INDEX `DocumentRoleAuditLog_targetUserId_createdAt_idx` ON `DocumentRoleAuditLog`(`targetUserId`, `createdAt`);
CREATE INDEX `DocumentRoleAuditLog_assignmentId_createdAt_idx` ON `DocumentRoleAuditLog`(`assignmentId`, `createdAt`);
CREATE INDEX `DocumentRoleAuditLog_action_createdAt_idx` ON `DocumentRoleAuditLog`(`action`, `createdAt`);

ALTER TABLE `DocumentRoleAssignment` ADD CONSTRAINT `DocumentRoleAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DocumentRoleAssignment` ADD CONSTRAINT `DocumentRoleAssignment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DocumentRoleAssignment` ADD CONSTRAINT `DocumentRoleAssignment_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DocumentRoleAssignment` ADD CONSTRAINT `DocumentRoleAssignment_disabledById_fkey` FOREIGN KEY (`disabledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DocumentRoleAssignment` ADD CONSTRAINT `DocumentRoleAssignment_substituteForUserId_fkey` FOREIGN KEY (`substituteForUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DocumentRoleAssignment` ADD CONSTRAINT `DocumentRoleAssignment_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DocumentRoleAssignment` ADD CONSTRAINT `DocumentRoleAssignment_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `CostCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DocumentRoleAssignment` ADD CONSTRAINT `DocumentRoleAssignment_documentTypeId_fkey` FOREIGN KEY (`documentTypeId`) REFERENCES `DocumentTypeCatalog`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DocumentRoleAssignment` ADD CONSTRAINT `DocumentRoleAssignment_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `IsoDocument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DocumentRoleAssignment` ADD CONSTRAINT `DocumentRoleAssignment_approverGroupId_fkey` FOREIGN KEY (`approverGroupId`) REFERENCES `ApproverGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DocumentRoleAuditLog` ADD CONSTRAINT `DocumentRoleAuditLog_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `DocumentRoleAssignment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DocumentRoleAuditLog` ADD CONSTRAINT `DocumentRoleAuditLog_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DocumentRoleAuditLog` ADD CONSTRAINT `DocumentRoleAuditLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
