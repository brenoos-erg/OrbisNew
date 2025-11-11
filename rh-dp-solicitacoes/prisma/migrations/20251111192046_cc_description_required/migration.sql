/*
  Warnings:

  - Made the column `description` on table `CostCenter` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "CostCenter" ALTER COLUMN "description" SET NOT NULL;
