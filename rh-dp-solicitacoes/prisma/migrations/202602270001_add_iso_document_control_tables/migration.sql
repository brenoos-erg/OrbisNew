-- CreateTable
CREATE TABLE `DocumentTypeCatalog` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NOT NULL,
  `controlledCopy` BOOLEAN NOT NULL DEFAULT false,
  `linkCostCenterArea` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `DocumentTypeCatalog_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApproverGroup` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `departmentId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ApproverGroup_name_departmentId_key`(`name`, `departmentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApproverGroupMember` (
  `id` VARCHAR(191) NOT NULL,
  `groupId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,

  UNIQUE INDEX `ApproverGroupMember_groupId_userId_key`(`groupId`, `userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentTypeApprovalFlow` (
  `id` VARCHAR(191) NOT NULL,
  `documentTypeId` VARCHAR(191) NOT NULL,
  `order` INTEGER NOT NULL,
  `stepType` ENUM('REVIEW', 'QUALITY', 'SIG', 'APPROVAL_GENERIC') NOT NULL,
  `approverGroupId` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,

  UNIQUE INDEX `DocumentTypeApprovalFlow_documentTypeId_order_key`(`documentTypeId`, `order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IsoDocument` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `documentTypeId` VARCHAR(191) NOT NULL,
  `ownerDepartmentId` VARCHAR(191) NOT NULL,
  `authorUserId` VARCHAR(191) NOT NULL,
  `physicalLocation` VARCHAR(191) NULL,
  `accessType` VARCHAR(191) NOT NULL,
  `validityAt` DATETIME(3) NULL,
  `summary` LONGTEXT NULL,
  `affectedAreasNotes` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `IsoDocument_code_key`(`code`),
  INDEX `IsoDocument_ownerDepartmentId_idx`(`ownerDepartmentId`),
  INDEX `IsoDocument_authorUserId_idx`(`authorUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentVersion` (
  `id` VARCHAR(191) NOT NULL,
  `documentId` VARCHAR(191) NOT NULL,
  `revisionNumber` INTEGER NOT NULL,
  `status` ENUM('EM_ELABORACAO', 'EM_REVISAO', 'EM_ANALISE_QUALIDADE', 'AG_APROVACAO', 'PUBLICADO', 'CANCELADO', 'VENCIDO') NOT NULL,
  `fileUrl` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `publishedAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `nextReviewAt` DATETIME(3) NULL,
  `isCurrentPublished` BOOLEAN NOT NULL DEFAULT false,

  UNIQUE INDEX `DocumentVersion_documentId_revisionNumber_key`(`documentId`, `revisionNumber`),
  INDEX `DocumentVersion_status_publishedAt_idx`(`status`, `publishedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentApproval` (
  `id` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NOT NULL,
  `flowItemId` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `decidedById` VARCHAR(191) NULL,
  `decidedAt` DATETIME(3) NULL,
  `comment` VARCHAR(191) NULL,

  UNIQUE INDEX `DocumentApproval_versionId_flowItemId_key`(`versionId`, `flowItemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentAttachment` (
  `id` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `fileUrl` TEXT NOT NULL,
  `uploadedById` VARCHAR(191) NOT NULL,
  `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentDownloadLog` (
  `id` VARCHAR(191) NOT NULL,
  `documentId` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `downloadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ip` VARCHAR(191) NULL,
  `userAgent` VARCHAR(191) NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentResponsibilityTerm` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentTermAcceptance` (
  `id` VARCHAR(191) NOT NULL,
  `termId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ip` VARCHAR(191) NULL,
  `userAgent` VARCHAR(191) NULL,

  UNIQUE INDEX `DocumentTermAcceptance_termId_userId_key`(`termId`, `userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Distribution` (
  `id` VARCHAR(191) NOT NULL,
  `documentId` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DistributionTarget` (
  `id` VARCHAR(191) NOT NULL,
  `distributionId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,

  UNIQUE INDEX `DistributionTarget_distributionId_userId_key`(`distributionId`, `userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReadReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'ACK') NOT NULL DEFAULT 'PENDING',
  `acknowledgedAt` DATETIME(3) NULL,

  UNIQUE INDEX `ReadReceipt_targetId_versionId_key`(`targetId`, `versionId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrintCopy` (
  `id` VARCHAR(191) NOT NULL,
  `documentId` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NOT NULL,
  `type` ENUM('CONTROLLED', 'UNCONTROLLED') NOT NULL,
  `issuedById` VARCHAR(191) NOT NULL,
  `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ApproverGroup` ADD CONSTRAINT `ApproverGroup_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ApproverGroupMember` ADD CONSTRAINT `ApproverGroupMember_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ApproverGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ApproverGroupMember` ADD CONSTRAINT `ApproverGroupMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentTypeApprovalFlow` ADD CONSTRAINT `DocumentTypeApprovalFlow_documentTypeId_fkey` FOREIGN KEY (`documentTypeId`) REFERENCES `DocumentTypeCatalog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentTypeApprovalFlow` ADD CONSTRAINT `DocumentTypeApprovalFlow_approverGroupId_fkey` FOREIGN KEY (`approverGroupId`) REFERENCES `ApproverGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `IsoDocument` ADD CONSTRAINT `IsoDocument_documentTypeId_fkey` FOREIGN KEY (`documentTypeId`) REFERENCES `DocumentTypeCatalog`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `IsoDocument` ADD CONSTRAINT `IsoDocument_ownerDepartmentId_fkey` FOREIGN KEY (`ownerDepartmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `IsoDocument` ADD CONSTRAINT `IsoDocument_authorUserId_fkey` FOREIGN KEY (`authorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DocumentVersion` ADD CONSTRAINT `DocumentVersion_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `IsoDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentApproval` ADD CONSTRAINT `DocumentApproval_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentApproval` ADD CONSTRAINT `DocumentApproval_flowItemId_fkey` FOREIGN KEY (`flowItemId`) REFERENCES `DocumentTypeApprovalFlow`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DocumentApproval` ADD CONSTRAINT `DocumentApproval_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DocumentAttachment` ADD CONSTRAINT `DocumentAttachment_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentAttachment` ADD CONSTRAINT `DocumentAttachment_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DocumentDownloadLog` ADD CONSTRAINT `DocumentDownloadLog_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `IsoDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentDownloadLog` ADD CONSTRAINT `DocumentDownloadLog_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentDownloadLog` ADD CONSTRAINT `DocumentDownloadLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentTermAcceptance` ADD CONSTRAINT `DocumentTermAcceptance_termId_fkey` FOREIGN KEY (`termId`) REFERENCES `DocumentResponsibilityTerm`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentTermAcceptance` ADD CONSTRAINT `DocumentTermAcceptance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Distribution` ADD CONSTRAINT `Distribution_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `IsoDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Distribution` ADD CONSTRAINT `Distribution_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Distribution` ADD CONSTRAINT `Distribution_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DistributionTarget` ADD CONSTRAINT `DistributionTarget_distributionId_fkey` FOREIGN KEY (`distributionId`) REFERENCES `Distribution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DistributionTarget` ADD CONSTRAINT `DistributionTarget_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReadReceipt` ADD CONSTRAINT `ReadReceipt_targetId_fkey` FOREIGN KEY (`targetId`) REFERENCES `DistributionTarget`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReadReceipt` ADD CONSTRAINT `ReadReceipt_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReadReceipt` ADD CONSTRAINT `ReadReceipt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PrintCopy` ADD CONSTRAINT `PrintCopy_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `IsoDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PrintCopy` ADD CONSTRAINT `PrintCopy_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PrintCopy` ADD CONSTRAINT `PrintCopy_issuedById_fkey` FOREIGN KEY (`issuedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;