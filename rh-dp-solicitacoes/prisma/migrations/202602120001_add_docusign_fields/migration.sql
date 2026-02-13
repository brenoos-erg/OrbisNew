-- CreateTable
CREATE TABLE `Attachment` (
    `id` VARCHAR(191) NOT NULL,
    `solicitationId` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefusalAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefusalReport` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `employeeName` VARCHAR(191) NOT NULL,
    `sectorOrContract` VARCHAR(191) NOT NULL,
    `riskSituation` VARCHAR(191) NOT NULL,
    `locationOrEquipment` VARCHAR(191) NOT NULL,
    `detailedCondition` VARCHAR(191) NOT NULL,
    `contractManagerName` VARCHAR(191) NULL,
    `generalCoordinatorName` VARCHAR(191) NULL,
    `contractManagerId` VARCHAR(191) NULL,
    `generalCoordinatorId` VARCHAR(191) NULL,
    `status` ENUM('PENDENTE', 'APROVADA', 'REJEITADA') NOT NULL DEFAULT 'PENDENTE',
    `decision` BOOLEAN NULL,
    `decisionComment` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `decidedById` VARCHAR(191) NULL,
    `decisionLevel` ENUM('NIVEL_1', 'NIVEL_2', 'NIVEL_3') NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comment` (
    `id` VARCHAR(191) NOT NULL,
    `solicitationId` VARCHAR(191) NOT NULL,
    `autorId` VARCHAR(191) NOT NULL,
    `texto` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Event` (
    `id` VARCHAR(191) NOT NULL,
    `solicitationId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostCenter` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `abbreviation` VARCHAR(191) NULL,
    `area` VARCHAR(191) NULL,
    `code` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `externalCode` VARCHAR(191) NULL,
    `managementType` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `group_name` VARCHAR(191) NULL,
    `observations` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,

    UNIQUE INDEX `CostCenter_externalCode_uq`(`externalCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Position` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `behavioralCompetencies` VARCHAR(191) NULL,
    `complementaryActivities` VARCHAR(191) NULL,
    `course` VARCHAR(191) NULL,
    `courseInProgress` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `enxoval` VARCHAR(191) NULL,
    `experience` VARCHAR(191) NULL,
    `mainActivities` VARCHAR(191) NULL,
    `others` VARCHAR(191) NULL,
    `periodModule` VARCHAR(191) NULL,
    `requiredKnowledge` VARCHAR(191) NULL,
    `schooling` VARCHAR(191) NULL,
    `schoolingCompleted` VARCHAR(191) NULL,
    `sectorProject` VARCHAR(191) NULL,
    `site` VARCHAR(191) NULL,
    `uniform` VARCHAR(191) NULL,
    `workPoint` VARCHAR(191) NULL,
    `workSchedule` VARCHAR(191) NULL,
    `workplace` VARCHAR(191) NULL,

    UNIQUE INDEX `Position_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Leader` (
    `id` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Leader_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TipoSolicitacao` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `schemaJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TipoSolicitacao_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Department` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `code` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Department_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Solicitation` (
    `id` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `tipoId` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `approvalAt` DATETIME(3) NULL,
    `approvalComment` VARCHAR(191) NULL,
    `approvalStatus` ENUM('NAO_PRECISA', 'PENDENTE', 'APROVADO', 'REPROVADO') NOT NULL DEFAULT 'NAO_PRECISA',
    `approverId` VARCHAR(191) NULL,
    `costCenterId` VARCHAR(191) NULL,
    `dataAbertura` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dataCancelamento` DATETIME(3) NULL,
    `dataFechamento` DATETIME(3) NULL,
    `dataPrevista` DATETIME(3) NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `prioridade` ENUM('BAIXA', 'MEDIA', 'ALTA', 'URGENTE') NULL,
    `protocolo` VARCHAR(191) NOT NULL,
    `requiresApproval` BOOLEAN NOT NULL DEFAULT false,
    `solicitanteId` VARCHAR(191) NOT NULL,
    `status` ENUM('ABERTA', 'EM_ATENDIMENTO', 'AGUARDANDO_APROVACAO', 'AGUARDANDO_TERMO', 'CONCLUIDA', 'CANCELADA') NOT NULL DEFAULT 'ABERTA',
    `parentId` VARCHAR(191) NULL,
    `vagaPrevista` BOOLEAN NOT NULL DEFAULT false,
    `assumidaPorId` VARCHAR(191) NULL,
    `assumidaEm` DATETIME(3) NULL,

    UNIQUE INDEX `Solicitation_protocolo_key`(`protocolo`),
    INDEX `Solicitation_solicitanteId_dataAbertura_idx`(`solicitanteId`, `dataAbertura`),
    INDEX `Solicitation_costCenterId_dataAbertura_idx`(`costCenterId`, `dataAbertura`),
    INDEX `Solicitation_departmentId_dataAbertura_idx`(`departmentId`, `dataAbertura`),
    INDEX `Solicitation_requiresApproval_approvalStatus_dataAbertura_idx`(`requiresApproval`, `approvalStatus`, `dataAbertura`),
    INDEX `Solicitation_status_dataAbertura_idx`(`status`, `dataAbertura`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `solicitationId` VARCHAR(191) NULL,
    `type` ENUM('TERMO_RESPONSABILIDADE') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `pdfUrl` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NOT NULL,

    INDEX `Document_solicitationId_idx`(`solicitationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDENTE', 'AGUARDANDO_ASSINATURA', 'ASSINADO', 'RECUSADO') NOT NULL DEFAULT 'PENDENTE',
    `signingProvider` VARCHAR(191) NULL,
    `signingUrl` VARCHAR(191) NULL,
    `signingExternalId` VARCHAR(191) NULL,
    `signingReturnUrl` VARCHAR(191) NULL,
    `signedAt` DATETIME(3) NULL,
    `auditTrailUrl` VARCHAR(191) NULL,
    `auditTrailHash` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DocumentAssignment_userId_status_idx`(`userId`, `status`),
    UNIQUE INDEX `DocumentAssignment_documentId_userId_key`(`documentId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SolicitacaoSetor` (
    `id` VARCHAR(191) NOT NULL,
    `solicitacaoId` VARCHAR(191) NOT NULL,
    `setor` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDENTE',
    `constaFlag` VARCHAR(191) NULL,
    `campos` JSON NULL,
    `finalizadoEm` DATETIME(3) NULL,
    `finalizadoPor` VARCHAR(191) NULL,

    INDEX `SolicitacaoSetor_setor_status_idx`(`setor`, `status`),
    UNIQUE INDEX `SolicitacaoSetor_solicitacaoId_setor_key`(`solicitacaoId`, `setor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `role` ENUM('COLABORADOR', 'RH', 'DP', 'ADMIN') NOT NULL DEFAULT 'COLABORADOR',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NULL,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `resetTokenHash` VARCHAR(191) NULL,
    `resetTokenExpiresAt` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `login` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `status` ENUM('ATIVO', 'INATIVO') NOT NULL DEFAULT 'ATIVO',
    `leaderId` VARCHAR(191) NULL,
    `costCenterId` VARCHAR(191) NULL,
    `positionId` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `user_login_key`(`login`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Module` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Module_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccessGroup` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AccessGroup_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupMember` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `role` ENUM('MEMBER', 'MANAGER') NOT NULL DEFAULT 'MEMBER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GroupMember_userId_groupId_key`(`userId`, `groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccessGroupGrant` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `moduleId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AccessGroupGrant_groupId_moduleId_key`(`groupId`, `moduleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccessGroupGrantAction` (
    `id` VARCHAR(191) NOT NULL,
    `grantId` VARCHAR(191) NOT NULL,
    `action` ENUM('VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AccessGroupGrantAction_grantId_idx`(`grantId`),
    UNIQUE INDEX `AccessGroupGrantAction_grantId_action_key`(`grantId`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModuleFeature` (
    `id` VARCHAR(191) NOT NULL,
    `moduleId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ModuleFeature_moduleId_key_key`(`moduleId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeatureGrant` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `featureId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FeatureGrant_groupId_featureId_key`(`groupId`, `featureId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeatureGrantAction` (
    `id` VARCHAR(191) NOT NULL,
    `grantId` VARCHAR(191) NOT NULL,
    `action` ENUM('VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FeatureGrantAction_grantId_idx`(`grantId`),
    UNIQUE INDEX `FeatureGrantAction_grantId_action_key`(`grantId`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeatureLevelGrant` (
    `id` VARCHAR(191) NOT NULL,
    `featureId` VARCHAR(191) NOT NULL,
    `level` ENUM('NIVEL_1', 'NIVEL_2', 'NIVEL_3') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FeatureLevelGrant_featureId_level_key`(`featureId`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeatureLevelGrantAction` (
    `id` VARCHAR(191) NOT NULL,
    `grantId` VARCHAR(191) NOT NULL,
    `action` ENUM('VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FeatureLevelGrantAction_grantId_idx`(`grantId`),
    UNIQUE INDEX `FeatureLevelGrantAction_grantId_action_key`(`grantId`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostCenterModule` (
    `id` VARCHAR(191) NOT NULL,
    `costCenterId` VARCHAR(191) NOT NULL,
    `moduleId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CostCenterModule_costCenterId_moduleId_key`(`costCenterId`, `moduleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserCostCenter` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `costCenterId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserCostCenter_userId_costCenterId_key`(`userId`, `costCenterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SolicitationTimeline` (
    `id` VARCHAR(191) NOT NULL,
    `solicitationId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserModuleAccess` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `moduleId` VARCHAR(191) NOT NULL,
    `level` ENUM('NIVEL_1', 'NIVEL_2', 'NIVEL_3') NOT NULL,

    UNIQUE INDEX `UserModuleAccess_userId_moduleId_key`(`userId`, `moduleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DepartmentModule` (
    `id` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `moduleId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `DepartmentModule_departmentId_moduleId_key`(`departmentId`, `moduleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserDepartment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserDepartment_userId_departmentId_key`(`userId`, `departmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TiEquipment` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `patrimonio` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `value` DECIMAL(14, 2) NULL,
    `costCenterIdSnapshot` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NULL,
    `category` ENUM('LINHA_TELEFONICA', 'SMARTPHONE', 'NOTEBOOK', 'DESKTOP', 'MONITOR', 'IMPRESSORA', 'TPLINK', 'OUTROS') NOT NULL,
    `status` ENUM('IN_STOCK', 'ASSIGNED', 'MAINTENANCE', 'RETIRED') NOT NULL DEFAULT 'IN_STOCK',
    `observations` VARCHAR(191) NULL,

    UNIQUE INDEX `TiEquipment_patrimonio_key`(`patrimonio`),
    UNIQUE INDEX `TiEquipment_serialNumber_key`(`serialNumber`),
    INDEX `TiEquipment_category_status_idx`(`category`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vehicle` (
    `id` VARCHAR(191) NOT NULL,
    `plate` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NULL,
    `costCenter` VARCHAR(191) NULL,
    `sector` VARCHAR(191) NULL,
    `kmCurrent` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DISPONIVEL',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Vehicle_plate_key`(`plate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VehicleCostCenter` (
    `id` VARCHAR(191) NOT NULL,
    `vehicleId` VARCHAR(191) NOT NULL,
    `costCenterId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `VehicleCostCenter_vehicleId_costCenterId_key`(`vehicleId`, `costCenterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VehicleCheckin` (
    `id` VARCHAR(191) NOT NULL,
    `vehicleId` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `inspectionDate` DATETIME(3) NOT NULL,
    `costCenter` VARCHAR(191) NULL,
    `sectorActivity` VARCHAR(191) NULL,
    `driverName` VARCHAR(191) NOT NULL,
    `vehiclePlateSnapshot` VARCHAR(191) NOT NULL,
    `vehicleTypeSnapshot` VARCHAR(191) NOT NULL,
    `kmAtInspection` INTEGER NOT NULL,
    `checklistJson` JSON NOT NULL,
    `fatigueJson` JSON NOT NULL,
    `fatigueScore` INTEGER NOT NULL,
    `fatigueRisk` VARCHAR(191) NOT NULL,
    `driverStatus` VARCHAR(191) NOT NULL,
    `hasNonConformity` BOOLEAN NOT NULL,
    `nonConformityCriticality` VARCHAR(191) NULL,
    `nonConformityActions` VARCHAR(191) NULL,
    `nonConformityManager` VARCHAR(191) NULL,
    `nonConformityDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `vehicleStatus` VARCHAR(191) NOT NULL DEFAULT 'DISPONIVEL',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VehicleStatusLog` (
    `id` VARCHAR(191) NOT NULL,
    `vehicleId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VehicleDisplacementCheckin` (
    `id` VARCHAR(191) NOT NULL,
    `vehicleId` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `tripDate` DATETIME(3) NOT NULL,
    `costCenterId` VARCHAR(191) NULL,
    `origin` VARCHAR(191) NOT NULL,
    `destination` VARCHAR(191) NOT NULL,
    `vehiclePlateSnapshot` VARCHAR(191) NOT NULL,
    `vehicleTypeSnapshot` VARCHAR(191) NOT NULL,
    `vehicleModelSnapshot` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `vehicleKmSnapshot` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkRefusal` (
    `id` VARCHAR(191) NOT NULL,
    `gestorContrato` VARCHAR(191) NOT NULL,
    `coordenadorGeral` VARCHAR(191) NOT NULL,
    `nomeEmpregado` VARCHAR(191) NOT NULL,
    `matricula` VARCHAR(191) NULL,
    `setorContrato` VARCHAR(191) NOT NULL,
    `situacaoRisco` VARCHAR(191) NOT NULL,
    `localOuEquipamento` VARCHAR(191) NOT NULL,
    `descricaoDetalhadaRisco` VARCHAR(191) NOT NULL,
    `status` ENUM('EM_PREENCHIMENTO', 'AGUARDANDO_PARECER', 'PROCEDENTE', 'NAO_PROCEDENTE', 'ENCERRADO') NOT NULL DEFAULT 'AGUARDANDO_PARECER',
    `procede` BOOLEAN NULL,
    `parecerRecomendacoes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `analyzedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `analyzedById` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkRefusalAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `workRefusalId` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkRefusalHistory` (
    `id` VARCHAR(191) NOT NULL,
    `workRefusalId` VARCHAR(191) NOT NULL,
    `status` ENUM('EM_PREENCHIMENTO', 'AGUARDANDO_PARECER', 'PROCEDENTE', 'NAO_PROCEDENTE', 'ENCERRADO') NOT NULL,
    `message` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_solicitationId_fkey` FOREIGN KEY (`solicitationId`) REFERENCES `Solicitation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefusalAttachment` ADD CONSTRAINT `RefusalAttachment_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `RefusalReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefusalReport` ADD CONSTRAINT `RefusalReport_contractManagerId_fkey` FOREIGN KEY (`contractManagerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefusalReport` ADD CONSTRAINT `RefusalReport_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefusalReport` ADD CONSTRAINT `RefusalReport_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefusalReport` ADD CONSTRAINT `RefusalReport_generalCoordinatorId_fkey` FOREIGN KEY (`generalCoordinatorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_solicitationId_fkey` FOREIGN KEY (`solicitationId`) REFERENCES `Solicitation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_solicitationId_fkey` FOREIGN KEY (`solicitationId`) REFERENCES `Solicitation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostCenter` ADD CONSTRAINT `CostCenter_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Position` ADD CONSTRAINT `Position_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Solicitation` ADD CONSTRAINT `Solicitation_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `Solicitation` ADD CONSTRAINT `Solicitation_assumidaPorId_fkey` FOREIGN KEY (`assumidaPorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `Solicitation` ADD CONSTRAINT `Solicitation_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `CostCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Solicitation` ADD CONSTRAINT `Solicitation_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Solicitation` ADD CONSTRAINT `Solicitation_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Solicitation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Solicitation` ADD CONSTRAINT `Solicitation_solicitanteId_fkey` FOREIGN KEY (`solicitanteId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Solicitation` ADD CONSTRAINT `Solicitation_tipoId_fkey` FOREIGN KEY (`tipoId`) REFERENCES `TipoSolicitacao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_solicitationId_fkey` FOREIGN KEY (`solicitationId`) REFERENCES `Solicitation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentAssignment` ADD CONSTRAINT `DocumentAssignment_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentAssignment` ADD CONSTRAINT `DocumentAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SolicitacaoSetor` ADD CONSTRAINT `SolicitacaoSetor_solicitacaoId_fkey` FOREIGN KEY (`solicitacaoId`) REFERENCES `Solicitation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `CostCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_leaderId_fkey` FOREIGN KEY (`leaderId`) REFERENCES `Leader`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `Position`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `AccessGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `AccessGroupGrant` ADD CONSTRAINT `AccessGroupGrant_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `AccessGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessGroupGrant` ADD CONSTRAINT `AccessGroupGrant_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `Module`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessGroupGrantAction` ADD CONSTRAINT `AccessGroupGrantAction_grantId_fkey` FOREIGN KEY (`grantId`) REFERENCES `AccessGroupGrant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModuleFeature` ADD CONSTRAINT `ModuleFeature_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `Module`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeatureGrant` ADD CONSTRAINT `FeatureGrant_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `AccessGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeatureGrant` ADD CONSTRAINT `FeatureGrant_featureId_fkey` FOREIGN KEY (`featureId`) REFERENCES `ModuleFeature`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeatureGrantAction` ADD CONSTRAINT `FeatureGrantAction_grantId_fkey` FOREIGN KEY (`grantId`) REFERENCES `FeatureGrant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeatureLevelGrant` ADD CONSTRAINT `FeatureLevelGrant_featureId_fkey` FOREIGN KEY (`featureId`) REFERENCES `ModuleFeature`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeatureLevelGrantAction` ADD CONSTRAINT `FeatureLevelGrantAction_grantId_fkey` FOREIGN KEY (`grantId`) REFERENCES `FeatureLevelGrant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostCenterModule` ADD CONSTRAINT `CostCenterModule_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `CostCenter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostCenterModule` ADD CONSTRAINT `CostCenterModule_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `Module`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserCostCenter` ADD CONSTRAINT `UserCostCenter_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `CostCenter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserCostCenter` ADD CONSTRAINT `UserCostCenter_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `SolicitationTimeline` ADD CONSTRAINT `SolicitationTimeline_solicitationId_fkey` FOREIGN KEY (`solicitationId`) REFERENCES `Solicitation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserModuleAccess` ADD CONSTRAINT `UserModuleAccess_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `Module`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserModuleAccess` ADD CONSTRAINT `UserModuleAccess_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `DepartmentModule` ADD CONSTRAINT `DepartmentModule_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DepartmentModule` ADD CONSTRAINT `DepartmentModule_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `Module`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDepartment` ADD CONSTRAINT `UserDepartment_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDepartment` ADD CONSTRAINT `UserDepartment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `TiEquipment` ADD CONSTRAINT `TiEquipment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `TiEquipment` ADD CONSTRAINT `TiEquipment_costCenterIdSnapshot_fkey` FOREIGN KEY (`costCenterIdSnapshot`) REFERENCES `CostCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleCostCenter` ADD CONSTRAINT `VehicleCostCenter_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `CostCenter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleCostCenter` ADD CONSTRAINT `VehicleCostCenter_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleCheckin` ADD CONSTRAINT `VehicleCheckin_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleCheckin` ADD CONSTRAINT `VehicleCheckin_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleStatusLog` ADD CONSTRAINT `VehicleStatusLog_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `VehicleStatusLog` ADD CONSTRAINT `VehicleStatusLog_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleDisplacementCheckin` ADD CONSTRAINT `VehicleDisplacementCheckin_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `CostCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleDisplacementCheckin` ADD CONSTRAINT `VehicleDisplacementCheckin_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleDisplacementCheckin` ADD CONSTRAINT `VehicleDisplacementCheckin_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkRefusal` ADD CONSTRAINT `WorkRefusal_analyzedById_fkey` FOREIGN KEY (`analyzedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkRefusal` ADD CONSTRAINT `WorkRefusal_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkRefusalAttachment` ADD CONSTRAINT `WorkRefusalAttachment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkRefusalAttachment` ADD CONSTRAINT `WorkRefusalAttachment_workRefusalId_fkey` FOREIGN KEY (`workRefusalId`) REFERENCES `WorkRefusal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkRefusalHistory` ADD CONSTRAINT `WorkRefusalHistory_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkRefusalHistory` ADD CONSTRAINT `WorkRefusalHistory_workRefusalId_fkey` FOREIGN KEY (`workRefusalId`) REFERENCES `WorkRefusal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

