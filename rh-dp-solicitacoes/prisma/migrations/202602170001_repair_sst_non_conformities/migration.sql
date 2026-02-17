-- Repair migration for SST Non Conformities.
-- Handles environments with partial/failed 202602160001 migration.

CREATE TABLE IF NOT EXISTS `NonConformitySequence` (
  `year` INTEGER NOT NULL,
  `lastValue` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `NonConformity` (
  `id` VARCHAR(191) NOT NULL,
  `numeroRnc` VARCHAR(191) NOT NULL,
  `tipoNc` ENUM('AUDITORIA_CLIENTE', 'AUDITORIA_EXTERNA', 'AUDITORIA_INTERNA', 'OUTROS', 'PROCESSOS', 'NOTIFICACOES_CLIENTE') NOT NULL,
  `evidenciaObjetiva` LONGTEXT NOT NULL,
  `empresa` VARCHAR(191) NOT NULL DEFAULT 'ERG ENGENHARIA',
  `centroQueDetectouId` VARCHAR(191) NOT NULL,
  `centroQueOriginouId` VARCHAR(191) NOT NULL,
  `prazoAtendimento` DATETIME(3) NOT NULL,
  `fechamentoEm` DATETIME(3) NULL,
  `referenciaSig` VARCHAR(191) NULL,
  `gravidade` INTEGER NULL,
  `urgencia` INTEGER NULL,
  `tendencia` INTEGER NULL,
  `descricao` LONGTEXT NOT NULL,
  `aprovadoQualidadeEm` DATETIME(3) NULL,
  `aprovadoQualidadePorId` VARCHAR(191) NULL,
  `aprovadoQualidadeStatus` ENUM('PENDENTE', 'APROVADO', 'REPROVADO') NOT NULL DEFAULT 'PENDENTE',
  `aprovadoQualidadeObservacao` LONGTEXT NULL,
  `solicitanteId` VARCHAR(191) NOT NULL,
  `solicitanteNome` VARCHAR(191) NOT NULL,
  `solicitanteEmail` VARCHAR(191) NOT NULL,
  `status` ENUM('ABERTA', 'AGUARDANDO_APROVACAO_QUALIDADE', 'APROVADA_QUALIDADE', 'EM_TRATATIVA', 'AGUARDANDO_VERIFICACAO', 'ENCERRADA', 'CANCELADA') NOT NULL DEFAULT 'ABERTA',
  `acoesImediatas` LONGTEXT NULL,
  `causaRaiz` LONGTEXT NULL,
  `verificacaoEficaciaTexto` LONGTEXT NULL,
  `verificacaoEficaciaData` DATETIME(3) NULL,
  `verificacaoEficaciaAprovadoPorId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'tipoNc');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `tipoNc` ENUM(''AUDITORIA_CLIENTE'', ''AUDITORIA_EXTERNA'', ''AUDITORIA_INTERNA'', ''OUTROS'', ''PROCESSOS'', ''NOTIFICACOES_CLIENTE'') NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'evidenciaObjetiva');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `evidenciaObjetiva` LONGTEXT NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'empresa');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `empresa` VARCHAR(191) NOT NULL DEFAULT ''ERG ENGENHARIA''', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'centroQueDetectouId');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `centroQueDetectouId` VARCHAR(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'centroQueOriginouId');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `centroQueOriginouId` VARCHAR(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'prazoAtendimento');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `prazoAtendimento` DATETIME(3) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'fechamentoEm');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `fechamentoEm` DATETIME(3) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'referenciaSig');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `referenciaSig` VARCHAR(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'gravidade');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `gravidade` INTEGER NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'urgencia');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `urgencia` INTEGER NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'tendencia');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `tendencia` INTEGER NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'descricao');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `descricao` LONGTEXT NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'aprovadoQualidadeEm');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `aprovadoQualidadeEm` DATETIME(3) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'aprovadoQualidadePorId');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `aprovadoQualidadePorId` VARCHAR(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'aprovadoQualidadeStatus');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `aprovadoQualidadeStatus` ENUM(''PENDENTE'', ''APROVADO'', ''REPROVADO'') NOT NULL DEFAULT ''PENDENTE''', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'aprovadoQualidadeObservacao');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `aprovadoQualidadeObservacao` LONGTEXT NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'solicitanteId');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `solicitanteId` VARCHAR(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'solicitanteNome');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `solicitanteNome` VARCHAR(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'solicitanteEmail');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `solicitanteEmail` VARCHAR(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'status');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `status` ENUM(''ABERTA'', ''AGUARDANDO_APROVACAO_QUALIDADE'', ''APROVADA_QUALIDADE'', ''EM_TRATATIVA'', ''AGUARDANDO_VERIFICACAO'', ''ENCERRADA'', ''CANCELADA'') NOT NULL DEFAULT ''ABERTA''', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'acoesImediatas');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `acoesImediatas` LONGTEXT NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'causaRaiz');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `causaRaiz` LONGTEXT NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'verificacaoEficaciaTexto');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `verificacaoEficaciaTexto` LONGTEXT NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'verificacaoEficaciaData');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `verificacaoEficaciaData` DATETIME(3) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'verificacaoEficaciaAprovadoPorId');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `verificacaoEficaciaAprovadoPorId` VARCHAR(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformity` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `NonConformity` SET `tipoNc` = 'OUTROS' WHERE `tipoNc` IS NULL;

CREATE TABLE IF NOT EXISTS `NonConformityActionItem` (
   `id` VARCHAR(191) NOT NULL,
  `nonConformityId` VARCHAR(191) NOT NULL,
  `descricao` VARCHAR(191) NOT NULL,
  `responsavelId` VARCHAR(191) NULL,
  `responsavelNome` VARCHAR(191) NULL,
  `prazo` DATETIME(3) NULL,
  `status` ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA') NOT NULL DEFAULT 'PENDENTE',
  `evidencias` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityActionItem' AND COLUMN_NAME = 'responsavelId');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformityActionItem` ADD COLUMN `responsavelId` VARCHAR(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityActionItem' AND COLUMN_NAME = 'responsavelNome');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformityActionItem` ADD COLUMN `responsavelNome` VARCHAR(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityActionItem' AND COLUMN_NAME = 'prazo');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformityActionItem` ADD COLUMN `prazo` DATETIME(3) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityActionItem' AND COLUMN_NAME = 'status');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformityActionItem` ADD COLUMN `status` ENUM(''PENDENTE'', ''EM_ANDAMENTO'', ''CONCLUIDA'', ''CANCELADA'') NOT NULL DEFAULT ''PENDENTE''', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityActionItem' AND COLUMN_NAME = 'evidencias');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformityActionItem` ADD COLUMN `evidencias` LONGTEXT NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityActionItem' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformityActionItem` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityActionItem' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformityActionItem` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `NonConformityAttachment` (
  `id` VARCHAR(191) NOT NULL,
  `nonConformityId` VARCHAR(191) NOT NULL,
  `filename` VARCHAR(191) NOT NULL,
  `url` TEXT NOT NULL,
  `mimeType` VARCHAR(191) NOT NULL,
  `sizeBytes` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdById` VARCHAR(191) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityAttachment' AND COLUMN_NAME = 'mimeType');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformityAttachment` ADD COLUMN `mimeType` VARCHAR(191) NOT NULL DEFAULT ''application/octet-stream''', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityAttachment' AND COLUMN_NAME = 'sizeBytes');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformityAttachment` ADD COLUMN `sizeBytes` INTEGER NOT NULL DEFAULT 0', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityAttachment' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformityAttachment` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityAttachment' AND COLUMN_NAME = 'createdById');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `NonConformityAttachment` ADD COLUMN `createdById` VARCHAR(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `NonConformityComment` (
  `id` VARCHAR(191) NOT NULL,
  `nonConformityId` VARCHAR(191) NOT NULL,
  `autorId` VARCHAR(191) NOT NULL,
  `texto` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `NonConformityCauseItem` (
  `id` VARCHAR(191) NOT NULL,
  `nonConformityId` VARCHAR(191) NOT NULL,
  `ordem` INTEGER NOT NULL,
  `pergunta` VARCHAR(191) NOT NULL,
  `resposta` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `NonConformityTimeline` (
   `id` VARCHAR(191) NOT NULL,
  `nonConformityId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NULL,
  `tipo` VARCHAR(191) NOT NULL,
  `fromStatus` ENUM('ABERTA', 'AGUARDANDO_APROVACAO_QUALIDADE', 'APROVADA_QUALIDADE', 'EM_TRATATIVA', 'AGUARDANDO_VERIFICACAO', 'ENCERRADA', 'CANCELADA') NULL,
  `toStatus` ENUM('ABERTA', 'AGUARDANDO_APROVACAO_QUALIDADE', 'APROVADA_QUALIDADE', 'EM_TRATATIVA', 'AGUARDANDO_VERIFICACAO', 'ENCERRADA', 'CANCELADA') NULL,
  `message` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND INDEX_NAME = 'NonConformity_numeroRnc_key');
SET @sql := IF(@idx_exists = 0, 'CREATE UNIQUE INDEX `NonConformity_numeroRnc_key` ON `NonConformity`(`numeroRnc`)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND INDEX_NAME = 'NonConformity_status_createdAt_idx');
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX `NonConformity_status_createdAt_idx` ON `NonConformity`(`status`, `createdAt`)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND INDEX_NAME = 'NonConformity_centroQueDetectouId_centroQueOriginouId_idx');
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX `NonConformity_centroQueDetectouId_centroQueOriginouId_idx` ON `NonConformity`(`centroQueDetectouId`, `centroQueOriginouId`)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityActionItem' AND INDEX_NAME = 'NonConformityActionItem_nonConformityId_status_idx');
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX `NonConformityActionItem_nonConformityId_status_idx` ON `NonConformityActionItem`(`nonConformityId`, `status`)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityAttachment' AND INDEX_NAME = 'NonConformityAttachment_nonConformityId_createdAt_idx');
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX `NonConformityAttachment_nonConformityId_createdAt_idx` ON `NonConformityAttachment`(`nonConformityId`, `createdAt`)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityComment' AND INDEX_NAME = 'NonConformityComment_nonConformityId_createdAt_idx');
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX `NonConformityComment_nonConformityId_createdAt_idx` ON `NonConformityComment`(`nonConformityId`, `createdAt`)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityCauseItem' AND INDEX_NAME = 'NonConformityCauseItem_nonConformityId_ordem_idx');
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX `NonConformityCauseItem_nonConformityId_ordem_idx` ON `NonConformityCauseItem`(`nonConformityId`, `ordem`)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityTimeline' AND INDEX_NAME = 'NonConformityTimeline_nonConformityId_createdAt_idx');
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX `NonConformityTimeline_nonConformityId_createdAt_idx` ON `NonConformityTimeline`(`nonConformityId`, `createdAt`)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND CONSTRAINT_NAME = 'NonConformity_centroQueDetectouId_fkey');
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE `NonConformity` ADD CONSTRAINT `NonConformity_centroQueDetectouId_fkey` FOREIGN KEY (`centroQueDetectouId`) REFERENCES `CostCenter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND CONSTRAINT_NAME = 'NonConformity_centroQueOriginouId_fkey');
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE `NonConformity` ADD CONSTRAINT `NonConformity_centroQueOriginouId_fkey` FOREIGN KEY (`centroQueOriginouId`) REFERENCES `CostCenter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND CONSTRAINT_NAME = 'NonConformity_aprovadoQualidadePorId_fkey');
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE `NonConformity` ADD CONSTRAINT `NonConformity_aprovadoQualidadePorId_fkey` FOREIGN KEY (`aprovadoQualidadePorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND CONSTRAINT_NAME = 'NonConformity_solicitanteId_fkey');
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE `NonConformity` ADD CONSTRAINT `NonConformity_solicitanteId_fkey` FOREIGN KEY (`solicitanteId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformity' AND CONSTRAINT_NAME = 'NonConformity_verificacaoEficaciaAprovadoPorId_fkey');
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE `NonConformity` ADD CONSTRAINT `NonConformity_verificacaoEficaciaAprovadoPorId_fkey` FOREIGN KEY (`verificacaoEficaciaAprovadoPorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityActionItem' AND CONSTRAINT_NAME = 'NonConformityActionItem_nonConformityId_fkey');
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE `NonConformityActionItem` ADD CONSTRAINT `NonConformityActionItem_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityActionItem' AND CONSTRAINT_NAME = 'NonConformityActionItem_responsavelId_fkey');
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE `NonConformityActionItem` ADD CONSTRAINT `NonConformityActionItem_responsavelId_fkey` FOREIGN KEY (`responsavelId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityAttachment' AND CONSTRAINT_NAME = 'NonConformityAttachment_nonConformityId_fkey');
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE `NonConformityAttachment` ADD CONSTRAINT `NonConformityAttachment_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityAttachment' AND CONSTRAINT_NAME = 'NonConformityAttachment_createdById_fkey');
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE `NonConformityAttachment` ADD CONSTRAINT `NonConformityAttachment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityComment' AND CONSTRAINT_NAME = 'NonConformityComment_nonConformityId_fkey');
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE `NonConformityComment` ADD CONSTRAINT `NonConformityComment_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityComment' AND CONSTRAINT_NAME = 'NonConformityComment_autorId_fkey');
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE `NonConformityComment` ADD CONSTRAINT `NonConformityComment_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityCauseItem' AND CONSTRAINT_NAME = 'NonConformityCauseItem_nonConformityId_fkey');
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE `NonConformityCauseItem` ADD CONSTRAINT `NonConformityCauseItem_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityTimeline' AND CONSTRAINT_NAME = 'NonConformityTimeline_nonConformityId_fkey');
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE `NonConformityTimeline` ADD CONSTRAINT `NonConformityTimeline_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'NonConformityTimeline' AND CONSTRAINT_NAME = 'NonConformityTimeline_actorId_fkey');
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE `NonConformityTimeline` ADD CONSTRAINT `NonConformityTimeline_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;