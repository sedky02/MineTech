-- Rejected and answered questions can be sent back to review (SPEC §4).
ALTER TABLE "questions" ADD COLUMN "returned_to_review_at" TIMESTAMP(3);
