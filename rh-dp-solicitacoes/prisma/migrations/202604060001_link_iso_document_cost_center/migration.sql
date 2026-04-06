ALTER TABLE `IsoDocument`
  ADD COLUMN `ownerCostCenterId` VARCHAR(191) NULL,
  MODIFY COLUMN `ownerDepartmentId` VARCHAR(191) NULL;

UPDATE `IsoDocument` d
SET d.`ownerCostCenterId` = (
  SELECT cc.`id`
  FROM `CostCenter` cc
  WHERE cc.`departmentId` = d.`ownerDepartmentId`
  ORDER BY cc.`createdAt` ASC
  LIMIT 1
)
WHERE d.`ownerDepartmentId` IS NOT NULL
  AND d.`ownerCostCenterId` IS NULL;

CREATE INDEX `IsoDocument_ownerCostCenterId_idx` ON `IsoDocument`(`ownerCostCenterId`);

ALTER TABLE `IsoDocument`
  ADD CONSTRAINT `IsoDocument_ownerCostCenterId_fkey`
  FOREIGN KEY (`ownerCostCenterId`) REFERENCES `CostCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;