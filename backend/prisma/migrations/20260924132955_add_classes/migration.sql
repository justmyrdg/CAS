-- CreateEnum
CREATE TYPE "Term" AS ENUM ('FIRST_SEM', 'SECOND_SEM', 'SUMMER');

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "subjectCode" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "instructorId" TEXT NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classes_joinCode_key" ON "classes"("joinCode");

-- CreateIndex
CREATE INDEX "classes_instructorId_idx" ON "classes"("instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "classes_instructorId_subjectCode_section_term_schoolYear_key" ON "classes"("instructorId", "subjectCode", "section", "term", "schoolYear");

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
