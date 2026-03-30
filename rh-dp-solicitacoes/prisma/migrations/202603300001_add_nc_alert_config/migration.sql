CREATE TABLE `NonConformityAlertConfig` (
  `id` VARCHAR(191) NOT NULL,
  `eventCreatedEnabled` BOOLEAN NOT NULL DEFAULT true,
  `eventUpdatedEnabled` BOOLEAN NOT NULL DEFAULT false,
  `subjectTemplate` VARCHAR(191) NOT NULL,
  `bodyTemplate` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `NonConformityAlertRecipient` (
  `id` VARCHAR(191) NOT NULL,
  `configId` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `fullName` VARCHAR(191) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `NonConformityAlertRecipient_configId_email_key`(`configId`, `email`),
  CONSTRAINT `NonConformityAlertRecipient_configId_fkey` FOREIGN KEY (`configId`) REFERENCES `NonConformityAlertConfig`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;