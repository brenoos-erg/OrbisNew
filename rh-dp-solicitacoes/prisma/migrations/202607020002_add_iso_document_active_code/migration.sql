-- Enforce one active ISO document per code while preserving inactive POSTING_ERROR history.
ALTER TABLE `IsoDocument` ADD COLUMN `activeCode` VARCHAR(191) NULL;

UPDATE `IsoDocument`
SET `activeCode` = `code`
WHERE `isActive` = true;

CREATE UNIQUE INDEX `IsoDocument_activeCode_key` ON `IsoDocument`(`activeCode`);
