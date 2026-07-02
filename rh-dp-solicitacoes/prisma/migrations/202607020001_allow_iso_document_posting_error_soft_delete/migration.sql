-- Allow historical posting-error records to keep their original document code
-- while a new active IsoDocument reuses the same code.
ALTER TABLE `IsoDocument` DROP INDEX `IsoDocument_code_key`;
CREATE INDEX `IsoDocument_code_idx` ON `IsoDocument`(`code`);
