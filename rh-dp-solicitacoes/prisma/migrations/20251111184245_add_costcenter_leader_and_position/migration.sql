-- AlterTable
ALTER TABLE "User" ADD COLUMN     "leaderId" TEXT,
ADD COLUMN     "position" TEXT;

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leader" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "login" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leader_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_name_key" ON "CostCenter"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Leader_email_key" ON "Leader"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Leader_login_key" ON "Leader"("login");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Leader"("id") ON DELETE SET NULL ON UPDATE CASCADE;
