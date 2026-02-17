-- CreateTable
CREATE TABLE `NonConformitySequence` (
    `year` INTEGER NOT NULL,
    `lastValue` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NonConformity` (
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

   UNIQUE INDEX `NonConformity_numeroRnc_key`(`numeroRnc`),
    INDEX `NonConformity_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `NonConformity_centroQueDetectouId_centroQueOriginouId_idx`(`centroQueDetectouId`, `centroQueOriginouId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NonConformityActionItem` (
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

    INDEX `NonConformityActionItem_nonConformityId_status_idx`(`nonConformityId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NonConformityAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `nonConformityId` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    -- CreateTable
CREATE TABLE `NonConformityCauseItem` (
    `id` VARCHAR(191) NOT NULL,
    `nonConformityId` VARCHAR(191) NOT NULL,
    `ordem` INTEGER NOT NULL,
    `pergunta` VARCHAR(191) NOT NULL,
    `resposta` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NonConformityCauseItem_nonConformityId_ordem_idx`(`nonConformityId`, `ordem`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NonConformityComment` (
    `id` VARCHAR(191) NOT NULL,
    `nonConformityId` VARCHAR(191) NOT NULL,
    `autorId` VARCHAR(191) NOT NULL,
    `texto` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NonConformityComment_nonConformityId_createdAt_idx`(`nonConformityId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NonConformityTimeline` (
    `id` VARCHAR(191) NOT NULL,
    `nonConformityId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `tipo` VARCHAR(191) NOT NULL,
       `fromStatus` ENUM('ABERTA', 'AGUARDANDO_APROVACAO_QUALIDADE', 'APROVADA_QUALIDADE', 'EM_TRATATIVA', 'AGUARDANDO_VERIFICACAO', 'ENCERRADA', 'CANCELADA') NULL,
    `toStatus` ENUM('ABERTA', 'AGUARDANDO_APROVACAO_QUALIDADE', 'APROVADA_QUALIDADE', 'EM_TRATATIVA', 'AGUARDANDO_VERIFICACAO', 'ENCERRADA', 'CANCELADA') NULL,
    `message` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NonConformityTimeline_nonConformityId_createdAt_idx`(`nonConformityId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NonConformity` ADD CONSTRAINT `NonConformity_centroQueDetectouId_fkey` FOREIGN KEY (`centroQueDetectouId`) REFERENCES `CostCenter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `NonConformity` ADD CONSTRAINT `NonConformity_centroQueOriginouId_fkey` FOREIGN KEY (`centroQueOriginouId`) REFERENCES `CostCenter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `NonConformity` ADD CONSTRAINT `NonConformity_aprovadoQualidadePorId_fkey` FOREIGN KEY (`aprovadoQualidadePorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `NonConformity` ADD CONSTRAINT `NonConformity_solicitanteId_fkey` FOREIGN KEY (`solicitanteId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `NonConformity` ADD CONSTRAINT `NonConformity_verificacaoEficaciaAprovadoPorId_fkey` FOREIGN KEY (`verificacaoEficaciaAprovadoPorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `NonConformityActionItem` ADD CONSTRAINT `NonConformityActionItem_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NonConformityActionItem` ADD CONSTRAINT `NonConformityActionItem_responsavelId_fkey` FOREIGN KEY (`responsavelId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `NonConformityAttachment` ADD CONSTRAINT `NonConformityAttachment_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NonConformityAttachment` ADD CONSTRAINT `NonConformityAttachment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `NonConformityCauseItem` ADD CONSTRAINT `NonConformityCauseItem_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NonConformityComment` ADD CONSTRAINT `NonConformityComment_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NonConformityComment` ADD CONSTRAINT `NonConformityComment_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `NonConformityTimeline` ADD CONSTRAINT `NonConformityTimeline_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NonConformityTimeline` ADD CONSTRAINT `NonConformityTimeline_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
