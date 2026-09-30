-- CreateTable
CREATE TABLE "ar_triggers" (
    "id" TEXT NOT NULL,
    "imageName" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arModelId" TEXT NOT NULL,

    CONSTRAINT "ar_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ar_triggers_imageName_key" ON "ar_triggers"("imageName");

-- CreateIndex
CREATE UNIQUE INDEX "ar_triggers_targetName_key" ON "ar_triggers"("targetName");

-- CreateIndex
CREATE INDEX "ar_triggers_arModelId_idx" ON "ar_triggers"("arModelId");

-- AddForeignKey
ALTER TABLE "ar_triggers" ADD CONSTRAINT "ar_triggers_arModelId_fkey" FOREIGN KEY ("arModelId") REFERENCES "ar_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
