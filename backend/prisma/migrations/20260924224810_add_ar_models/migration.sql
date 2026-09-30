-- AlterTable
ALTER TABLE "content_items" ADD COLUMN     "arModelId" TEXT;

-- CreateTable
CREATE TABLE "ar_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subjectId" TEXT,

    CONSTRAINT "ar_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ar_models_storedName_key" ON "ar_models"("storedName");

-- CreateIndex
CREATE INDEX "ar_models_subjectId_idx" ON "ar_models"("subjectId");

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_arModelId_fkey" FOREIGN KEY ("arModelId") REFERENCES "ar_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_models" ADD CONSTRAINT "ar_models_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
