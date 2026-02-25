ALTER TABLE `Department`
  ADD COLUMN `sigla` VARCHAR(191) NULL;

UPDATE `Department`
SET `sigla` = UPPER(
  CASE `code`
    WHEN '17' THEN 'RH'
    WHEN '08' THEN 'DP'
    WHEN '19' THEN 'SST'
    WHEN '11' THEN 'LOG'
    WHEN '20' THEN 'TI'
    ELSE CONCAT('D', `code`)
  END
)
WHERE `sigla` IS NULL;

ALTER TABLE `Department`
  MODIFY `sigla` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `Department_sigla_key` ON `Department`(`sigla`);