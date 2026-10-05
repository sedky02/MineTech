-- The "End event" feature is removed.
--
-- Undo an event that was ended (e.g. by accident in production): ending set
-- submissions_open = false and stamped ended_at, so reopen submissions only
-- where ended_at is set. A plain pause (ended_at NULL) is left untouched.
UPDATE "event_state" SET "submissions_open" = true WHERE "ended_at" IS NOT NULL;

-- AlterTable
ALTER TABLE "event_state" DROP COLUMN "ended_at";
