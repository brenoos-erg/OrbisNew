ALTER TABLE `Solicitation`
  ADD COLUMN `nonConformityId` VARCHAR(191) NULL;

CREATE INDEX `Solicitation_nonConformityId_idx` ON `Solicitation`(`nonConformityId`);

ALTER TABLE `Solicitation`
  ADD CONSTRAINT `Solicitation_nonConformityId_fkey`
  FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;