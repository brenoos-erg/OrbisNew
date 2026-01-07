-- CreateTable
CREATE TABLE "ModuleFeature" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureGrant" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "actions" "Action"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModuleFeature_moduleId_key_key" ON "ModuleFeature"("moduleId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureGrant_groupId_featureId_key" ON "FeatureGrant"("groupId", "featureId");

-- AddForeignKey
ALTER TABLE "ModuleFeature" ADD CONSTRAINT "ModuleFeature_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureGrant" ADD CONSTRAINT "FeatureGrant_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AccessGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureGrant" ADD CONSTRAINT "FeatureGrant_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "ModuleFeature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;