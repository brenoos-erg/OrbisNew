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
    `tipo` ENUM('PROCESSO', 'COMPORTAMENTAL', 'DOCUMENTAL', 'EQUIPAMENTO', 'OUTRO') NOT NULL,
    `classificacao` ENUM('LEVE', 'MODERADA', 'GRAVE') NOT NULL,
    `origem` ENUM('AUDITORIA', 'INSPECAO', 'OBSERVACAO', 'INCIDENTE', 'OUTRO') NOT NULL,
    `local` VARCHAR(191) NOT NULL,
    `dataOcorrencia` DATETIME(3) NOT NULL,
    `descricao` LONGTEXT NOT NULL,
    `solicitanteId` VARCHAR(191) NOT NULL,
    `solicitanteNome` VARCHAR(191) NOT NULL,
    `solicitanteEmail` VARCHAR(191) NOT NULL,
    `responsavelTratativaId` VARCHAR(191) NULL,
    `status` ENUM('ABERTA', 'EM_TRATATIVA', 'AGUARDANDO_VERIFICACAO', 'ENCERRADA', 'CANCELADA') NOT NULL DEFAULT 'ABERTA',
    `acaoImediata` LONGTEXT NULL,
    `dataAcaoImediata` DATETIME(3) NULL,
    `causaRaiz` LONGTEXT NULL,
    `verificacaoEficaciaTexto` LONGTEXT NULL,
    `verificacaoEficaciaData` DATETIME(3) NULL,
    `verificacaoEficaciaAprovadoPorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NonConformity_numeroRnc_key`(`numeroRnc`),
    INDEX `NonConformity_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `NonConformity_solicitanteId_createdAt_idx`(`solicitanteId`, `createdAt`),
    INDEX `NonConformity_responsavelTratativaId_status_idx`(`responsavelTratativaId`, `status`),
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
    `url` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NULL,

    INDEX `NonConformityAttachment_nonConformityId_createdAt_idx`(`nonConformityId`, `createdAt`),
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
    `fromStatus` ENUM('ABERTA', 'EM_TRATATIVA', 'AGUARDANDO_VERIFICACAO', 'ENCERRADA', 'CANCELADA') NULL,
    `toStatus` ENUM('ABERTA', 'EM_TRATATIVA', 'AGUARDANDO_VERIFICACAO', 'ENCERRADA', 'CANCELADA') NULL,
    `message` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NonConformityTimeline_nonConformityId_createdAt_idx`(`nonConformityId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NonConformity` ADD CONSTRAINT `NonConformity_solicitanteId_fkey` FOREIGN KEY (`solicitanteId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NonConformity` ADD CONSTRAINT `NonConformity_responsavelTratativaId_fkey` FOREIGN KEY (`responsavelTratativaId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NonConformity` ADD CONSTRAINT `NonConformity_verificacaoEficaciaAprovadoPorId_fkey` FOREIGN KEY (`verificacaoEficaciaAprovadoPorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NonConformityActionItem` ADD CONSTRAINT `NonConformityActionItem_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NonConformityActionItem` ADD CONSTRAINT `NonConformityActionItem_responsavelId_fkey` FOREIGN KEY (`responsavelId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NonConformityAttachment` ADD CONSTRAINT `NonConformityAttachment_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NonConformityAttachment` ADD CONSTRAINT `NonConformityAttachment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NonConformityComment` ADD CONSTRAINT `NonConformityComment_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NonConformityComment` ADD CONSTRAINT `NonConformityComment_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NonConformityTimeline` ADD CONSTRAINT `NonConformityTimeline_nonConformityId_fkey` FOREIGN KEY (`nonConformityId`) REFERENCES `NonConformity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NonConformityTimeline` ADD CONSTRAINT `NonConformityTimeline_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;