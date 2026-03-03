ALTER TABLE `Solicitation`
  ADD COLUMN `idempotencyKey` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Solicitation_idempotencyKey_key` ON `Solicitation`(`idempotencyKey`);