-- CreateEnum
CREATE TYPE "UserPrefix" AS ENUM ('MR', 'MS', 'DR', 'ENGR', 'PROF', 'ASST_PROF', 'ASSOC_PROF');

-- CreateEnum
CREATE TYPE "UserPosition" AS ENUM ('FULL_TIME', 'PART_TIME');

-- AlterTable: add new columns nullable first so existing rows don't fail the constraint
ALTER TABLE "users"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "middleName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "prefix" "UserPrefix",
  ADD COLUMN "position" "UserPosition",
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: split the old "name" on its first space
UPDATE "users"
SET
  "firstName" = CASE
    WHEN position(' ' in "name") > 0 THEN split_part("name", ' ', 1)
    ELSE "name"
  END,
  "lastName" = CASE
    WHEN position(' ' in "name") > 0 THEN substring("name" from position(' ' in "name") + 1)
    ELSE ''
  END;

-- Now safe to enforce NOT NULL
ALTER TABLE "users"
  ALTER COLUMN "firstName" SET NOT NULL,
  ALTER COLUMN "lastName" SET NOT NULL;

-- Drop the old column
ALTER TABLE "users" DROP COLUMN "name";
