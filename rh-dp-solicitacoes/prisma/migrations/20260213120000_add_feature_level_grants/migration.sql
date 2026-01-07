-- CreateTable
CREATE TABLE "FeatureLevelGrant" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "level" "ModuleLevel" NOT NULL,
    "actions" "Action"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureLevelGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureLevelGrant_featureId_level_key" ON "FeatureLevelGrant"("featureId", "level");

-- AddForeignKey
ALTER TABLE "FeatureLevelGrant" ADD CONSTRAINT "FeatureLevelGrant_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "ModuleFeature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;