ALTER TABLE `DocumentSegregationException`
  ADD COLUMN `pendingKey` VARCHAR(191) NULL;

ALTER TABLE `DocumentSegregationException`
  DROP INDEX `DocumentSegregationException_versionId_conflictType_requestedById_status_key`;

CREATE UNIQUE INDEX `DocumentSegregationException_pendingKey_key`
  ON `DocumentSegregationException`(`pendingKey`);

CREATE INDEX `DocumentSegregationException_requestedById_status_idx`
  ON `DocumentSegregationException`(`requestedById`, `status`);
