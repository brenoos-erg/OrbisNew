ALTER TABLE `NonConformityActionItem`
  ADD COLUMN `origemPlano` ENUM('NAO_CONFORMIDADE', 'PLANO_AVULSO') NOT NULL DEFAULT 'NAO_CONFORMIDADE',
  ADD COLUMN `createdById` VARCHAR(191) NULL;

ALTER TABLE `NonConformityActionItem`
  DROP FOREIGN KEY `NonConformityActionItem_nonConformityId_fkey`;

ALTER TABLE `NonConformityActionItem`
  MODIFY `nonConformityId` VARCHAR(191) NULL;

ALTER TABLE `NonConformityActionItem`
  ADD CONSTRAINT `NonConformityActionItem_nonConformityId_fkey`
  FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `NonConformityActionItem`
  ADD CONSTRAINT `NonConformityActionItem_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;