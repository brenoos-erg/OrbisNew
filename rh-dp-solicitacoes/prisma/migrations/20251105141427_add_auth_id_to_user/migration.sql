/*
  Warnings:

  - You are about to drop the column `dados` on the `Event` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[authId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Event" DROP COLUMN "dados";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "User_authId_key" ON "User"("authId");
