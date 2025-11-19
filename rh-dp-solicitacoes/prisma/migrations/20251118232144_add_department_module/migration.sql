/*
  Warnings:

  - Added the required column `updatedAt` to the `Module` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ModuleLevel" AS ENUM ('NIVEL_1', 'NIVEL_2', 'NIVEL_3');

-- AlterTable
ALTER TABLE "CostCenter" ADD COLUMN     "departmentId" TEXT;

-- AlterTable
ALTER TABLE "Module" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "UserModuleAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "level" "ModuleLevel" NOT NULL,

    CONSTRAINT "UserModuleAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentModule" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,

    CONSTRAINT "DepartmentModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserModuleAccess_userId_moduleId_key" ON "UserModuleAccess"("userId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentModule_departmentId_moduleId_key" ON "DepartmentModule"("departmentId", "moduleId");

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModuleAccess" ADD CONSTRAINT "UserModuleAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModuleAccess" ADD CONSTRAINT "UserModuleAccess_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentModule" ADD CONSTRAINT "DepartmentModule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentModule" ADD CONSTRAINT "DepartmentModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
