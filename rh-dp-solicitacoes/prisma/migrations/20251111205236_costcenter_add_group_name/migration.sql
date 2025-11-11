/*
  Warnings:

  - The values [ATIVADO,INATIVO] on the enum `CCStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `groupName` on the `CostCenter` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `CostCenter` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CCStatus_new" AS ENUM ('ACTIVE', 'INACTIVE');
ALTER TABLE "public"."CostCenter" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CostCenter" ALTER COLUMN "status" TYPE "CCStatus_new" USING ("status"::text::"CCStatus_new");
ALTER TYPE "CCStatus" RENAME TO "CCStatus_old";
ALTER TYPE "CCStatus_new" RENAME TO "CCStatus";
DROP TYPE "public"."CCStatus_old";
ALTER TABLE "CostCenter" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropIndex
DROP INDEX "CostCenter_code_key";

-- AlterTable
ALTER TABLE "CostCenter" DROP COLUMN "groupName",
DROP COLUMN "notes",
ADD COLUMN     "group_name" TEXT,
ADD COLUMN     "observations" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "code" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
