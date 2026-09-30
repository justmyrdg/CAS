-- CreateEnum
CREATE TYPE "AssessmentKind" AS ENUM ('QUIZ', 'EXAM');

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "kind" "AssessmentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "timeLimitMinutes" INTEGER,
    "maxAttempts" INTEGER,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "showAnswers" BOOLEAN NOT NULL DEFAULT true,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "classId" TEXT NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_attempts" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "answers" JSONB NOT NULL DEFAULT '{}',
    "results" JSONB NOT NULL DEFAULT '{}',
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "needsGrading" BOOLEAN NOT NULL DEFAULT false,
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,

    CONSTRAINT "assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessments_classId_idx" ON "assessments"("classId");

-- CreateIndex
CREATE INDEX "assessment_attempts_assessmentId_studentId_idx" ON "assessment_attempts"("assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "assessment_attempts_studentId_idx" ON "assessment_attempts"("studentId");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
