-- DropIndex
DROP INDEX "questions_status_idx";

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "position" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "questions_status_position_idx" ON "questions"("status", "position");

-- Backfill: keep today's order, i.e. the time each question entered its current list.
UPDATE "questions"
SET "position" = EXTRACT(EPOCH FROM COALESCE("host_approved_at", "moderator_approved_at", "created_at")) * 1000;
