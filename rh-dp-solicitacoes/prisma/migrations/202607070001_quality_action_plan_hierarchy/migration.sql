-- Create parent records for standalone Quality Action Plans and link legacy standalone actions.
CREATE TABLE `QualityActionPlanSequence` (
  `year` INTEGER NOT NULL,
  `lastValue` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `QualityActionPlan` (
  `id` VARCHAR(191) NOT NULL,
  `numeroPlano` VARCHAR(191) NOT NULL,
  `titulo` VARCHAR(191) NOT NULL,
  `objetivo` LONGTEXT NULL,
  `resultadoEsperado` LONGTEXT NULL,
  `origem` VARCHAR(120) NULL,
  `referencia` VARCHAR(120) NULL,
  `status` ENUM('ABERTO','EM_ANDAMENTO','CONCLUIDO','CANCELADO') NOT NULL DEFAULT 'ABERTO',
  `createdById` VARCHAR(191) NULL,
  `responsavelId` VARCHAR(191) NULL,
  `responsavelNome` VARCHAR(191) NULL,
  `centroResponsavelId` VARCHAR(191) NULL,
  `centroImpactadoId` VARCHAR(191) NULL,
  `dataInicioPrevista` DATETIME(3) NULL,
  `dataFimPrevista` DATETIME(3) NULL,
  `dataConclusao` DATETIME(3) NULL,
  `investimento` DECIMAL(12,2) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `QualityActionPlan_numeroPlano_key`(`numeroPlano`),
  INDEX `QualityActionPlan_status_createdAt_idx`(`status`, `createdAt`),
  INDEX `QualityActionPlan_numeroPlano_idx`(`numeroPlano`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `NonConformityActionItem` ADD COLUMN `qualityActionPlanId` VARCHAR(191) NULL;
CREATE INDEX `NonConformityActionItem_qualityActionPlanId_status_idx` ON `NonConformityActionItem`(`qualityActionPlanId`, `status`);

ALTER TABLE `QualityActionPlan` ADD CONSTRAINT `QualityActionPlan_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `QualityActionPlan` ADD CONSTRAINT `QualityActionPlan_responsavelId_fkey` FOREIGN KEY (`responsavelId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `QualityActionPlan` ADD CONSTRAINT `QualityActionPlan_centroResponsavelId_fkey` FOREIGN KEY (`centroResponsavelId`) REFERENCES `CostCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `QualityActionPlan` ADD CONSTRAINT `QualityActionPlan_centroImpactadoId_fkey` FOREIGN KEY (`centroImpactadoId`) REFERENCES `CostCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `NonConformityActionItem` ADD CONSTRAINT `NonConformityActionItem_qualityActionPlanId_fkey` FOREIGN KEY (`qualityActionPlanId`) REFERENCES `QualityActionPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Agrupa ações avulsas legadas por referência PA/PAV; ações sem referência ganham plano individual.
CREATE TEMPORARY TABLE `tmp_quality_action_plan_legacy_groups` AS
SELECT
  CASE
    WHEN `referencia` REGEXP '^(PA|PAV)[-_]?[0-9]{4}' THEN `referencia`
    ELSE `id`
  END AS `groupKey`,
  CASE
    WHEN `referencia` REGEXP '^(PA|PAV)[-_]?[0-9]{4}' THEN `referencia`
    ELSE CONCAT('PA-', YEAR(COALESCE(`createdAt`, NOW())), '-LEG-', LEFT(`id`, 8))
  END AS `numeroPlano`,
  MIN(`id`) AS `sampleActionId`,
  MIN(`createdAt`) AS `createdAt`,
  MAX(`updatedAt`) AS `updatedAt`
FROM `NonConformityActionItem`
WHERE `nonConformityId` IS NULL
  AND `origemPlano` = 'PLANO_AVULSO'
  AND `qualityActionPlanId` IS NULL
GROUP BY `groupKey`, `numeroPlano`;

INSERT INTO `QualityActionPlan` (`id`, `numeroPlano`, `titulo`, `origem`, `referencia`, `status`, `createdById`, `responsavelId`, `responsavelNome`, `centroResponsavelId`, `centroImpactadoId`, `dataInicioPrevista`, `dataFimPrevista`, `dataConclusao`, `createdAt`, `updatedAt`)
SELECT
  CONCAT('legacy_', MD5(g.`groupKey`)),
  g.`numeroPlano`,
  LEFT(CASE
    WHEN a.`referencia` IS NOT NULL AND a.`referencia` <> '' THEN CONCAT(a.`referencia`, ' - ', a.`descricao`)
    ELSE CONCAT('Plano avulso legado - ', a.`descricao`)
  END, 191),
  a.`origem`,
  a.`referencia`,
  CASE
    WHEN SUM(CASE WHEN ai.`status` <> 'CONCLUIDA' THEN 1 ELSE 0 END) = 0 THEN 'CONCLUIDO'
    WHEN SUM(CASE WHEN ai.`status` <> 'CANCELADA' THEN 1 ELSE 0 END) = 0 THEN 'CANCELADO'
    WHEN SUM(CASE WHEN ai.`status` = 'EM_ANDAMENTO' THEN 1 ELSE 0 END) > 0 THEN 'EM_ANDAMENTO'
    ELSE 'ABERTO'
  END,
  a.`createdById`,
  a.`responsavelId`,
  a.`responsavelNome`,
  a.`centroResponsavelId`,
  a.`centroImpactadoId`,
  MIN(ai.`dataInicioPrevista`),
  MAX(ai.`dataFimPrevista`),
  CASE WHEN SUM(CASE WHEN ai.`status` <> 'CONCLUIDA' THEN 1 ELSE 0 END) = 0 THEN MAX(ai.`dataConclusao`) ELSE NULL END,
  g.`createdAt`,
  g.`updatedAt`
FROM `tmp_quality_action_plan_legacy_groups` g
JOIN `NonConformityActionItem` a ON a.`id` = g.`sampleActionId`
JOIN `NonConformityActionItem` ai ON (
  CASE
    WHEN ai.`referencia` REGEXP '^(PA|PAV)[-_]?[0-9]{4}' THEN ai.`referencia`
    ELSE ai.`id`
  END
) = g.`groupKey`
WHERE ai.`nonConformityId` IS NULL
  AND ai.`origemPlano` = 'PLANO_AVULSO'
  AND ai.`qualityActionPlanId` IS NULL
GROUP BY g.`groupKey`, g.`numeroPlano`, g.`createdAt`, g.`updatedAt`, a.`referencia`, a.`descricao`, a.`origem`, a.`createdById`, a.`responsavelId`, a.`responsavelNome`, a.`centroResponsavelId`, a.`centroImpactadoId`;

UPDATE `NonConformityActionItem` ai
JOIN `tmp_quality_action_plan_legacy_groups` g ON (
  CASE
    WHEN ai.`referencia` REGEXP '^(PA|PAV)[-_]?[0-9]{4}' THEN ai.`referencia`
    ELSE ai.`id`
  END
) = g.`groupKey`
SET ai.`qualityActionPlanId` = CONCAT('legacy_', MD5(g.`groupKey`)),
    ai.`origemPlano` = 'PLANO_AVULSO'
WHERE ai.`nonConformityId` IS NULL
  AND ai.`origemPlano` = 'PLANO_AVULSO'
  AND ai.`qualityActionPlanId` IS NULL;

INSERT INTO `QualityActionPlanSequence` (`year`, `lastValue`, `createdAt`, `updatedAt`)
SELECT YEAR(NOW()), COALESCE(MAX(CAST(SUBSTRING_INDEX(`numeroPlano`, '-', -1) AS UNSIGNED)), 0), NOW(3), NOW(3)
FROM `QualityActionPlan`
WHERE `numeroPlano` REGEXP CONCAT('^PA-', YEAR(NOW()), '-[0-9]{4}$')
ON DUPLICATE KEY UPDATE
  `lastValue` = GREATEST(`lastValue`, VALUES(`lastValue`)),
  `updatedAt` = NOW(3);

DROP TEMPORARY TABLE `tmp_quality_action_plan_legacy_groups`;
