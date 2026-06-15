CREATE TABLE `NonConformityCauseStudyEditLog` (
    `id` VARCHAR(191) NOT NULL,
    `nonConformityId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `actorName` VARCHAR(191) NULL,
    `actorEmail` VARCHAR(191) NULL,
    `actorLogin` VARCHAR(191) NULL,
    `editedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `changes` JSON NOT NULL,

    INDEX `NonConformityCauseStudyEditLog_nonConformityId_idx`(`nonConformityId`),
    INDEX `NonConformityCauseStudyEditLog_editedAt_idx`(`editedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `NonConformityCauseStudyEditLog` ADD CONSTRAINT `NonConformityCauseStudyEditLog_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
