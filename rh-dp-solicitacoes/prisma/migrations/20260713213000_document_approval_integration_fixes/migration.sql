-- Diagnóstico obrigatório antes de alterar enums no MySQL:
-- SELECT DISTINCT status FROM DocumentVersion;
-- SELECT DISTINCT status FROM DocumentApproval;
-- SELECT DISTINCT event FROM DocumentNotificationLog;
-- SELECT DISTINCT event FROM DocumentNotificationRule;

ALTER TABLE `DocumentVersion` MODIFY `status` ENUM('EM_ELABORACAO','EM_REVISAO','EM_ANALISE_QUALIDADE','AG_APROVACAO','AGUARDANDO_PUBLICACAO','PUBLICADO','PUBLICANDO','CANCELADO','OBSOLETO','VENCIDO') NOT NULL;

ALTER TABLE `DocumentQualityChecklist`
  ADD COLUMN `roundId` VARCHAR(191) NULL,
  ADD COLUMN `stepId` VARCHAR(191) NULL;
CREATE INDEX `DocumentQualityChecklist_roundId_stepId_idx` ON `DocumentQualityChecklist`(`roundId`, `stepId`);
ALTER TABLE `DocumentQualityChecklist` ADD CONSTRAINT `DocumentQualityChecklist_roundId_fkey` FOREIGN KEY (`roundId`) REFERENCES `DocumentApprovalRound`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DocumentQualityChecklist` ADD CONSTRAINT `DocumentQualityChecklist_stepId_fkey` FOREIGN KEY (`stepId`) REFERENCES `DocumentApprovalStep`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
