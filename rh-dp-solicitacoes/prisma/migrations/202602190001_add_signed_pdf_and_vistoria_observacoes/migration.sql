-- AlterTable
ALTER TABLE `Document`
  ADD COLUMN `signedPdfUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `DocumentAssignment`
  ADD COLUMN `vistoriaObservacoes` LONGTEXT NULL;