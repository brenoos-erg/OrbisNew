/*
  Warnings:

  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[login]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fullName` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ATIVO', 'INATIVO');

-- DropIndex
DROP INDEX "public"."User_authId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
ADD COLUMN     "costCenter" TEXT,
ADD COLUMN     "fullName" TEXT NOT NULL,
ADD COLUMN     "login" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ATIVO',
ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;

-- CreateIndex
CREATE UNIQUE INDEX "user_login_key" ON "User"("login");
