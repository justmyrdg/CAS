-- AlterTable
ALTER TABLE "content_items" ADD COLUMN     "blocks" JSONB;

-- CreateTable
CREATE TABLE "lesson_images" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lesson_images_storedName_key" ON "lesson_images"("storedName");

-- Existing lesson text becomes a single text block.
UPDATE "content_items"
SET "blocks" = jsonb_build_array(jsonb_build_object('type', 'text', 'text', btrim("body")))
WHERE "type" = 'LESSON' AND "body" IS NOT NULL AND btrim("body") <> '';

UPDATE "content_items" SET "blocks" = '[]'::jsonb WHERE "type" = 'LESSON' AND "blocks" IS NULL;
