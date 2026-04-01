CREATE TABLE `DocumentTermActionAcceptance` (
  `id` VARCHAR(191) NOT NULL,
  `termId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NOT NULL,
  `intent` VARCHAR(16) NOT NULL,
  `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ip` VARCHAR(191) NULL,
  `userAgent` TEXT NULL,

  UNIQUE INDEX `DocumentTermActionAcceptance_unique`(`termId`, `userId`, `versionId`, `intent`),
  INDEX `DocumentTermActionAcceptance_userId_intent_acceptedAt_idx`(`userId`, `intent`, `acceptedAt`),
  INDEX `DocumentTermActionAcceptance_versionId_intent_acceptedAt_idx`(`versionId`, `intent`, `acceptedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DocumentTermActionAcceptance`
  ADD CONSTRAINT `DocumentTermActionAcceptance_termId_fkey`
  FOREIGN KEY (`termId`) REFERENCES `DocumentResponsibilityTerm`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DocumentTermActionAcceptance`
  ADD CONSTRAINT `DocumentTermActionAcceptance_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DocumentTermActionAcceptance`
  ADD CONSTRAINT `DocumentTermActionAcceptance_versionId_fkey`
  FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;