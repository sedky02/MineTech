-- Topics become a fixed list in code (src/common/categories.ts) instead of a
-- table. Questions keep their topic as a slug, checked by a constraint.

-- 1. Questions whose topic is not in the fixed list are deleted
--    (DevOps & Cloud, Game Development, and any other moderator-made topic).
DELETE FROM "questions" q
USING "categories" c
WHERE q."category_id" = c."id"
  AND c."slug" NOT IN (
    'web-development', 'ai-data', 'cybersecurity', 'mobile-development',
    'software-engineering', 'career-studies', 'general'
  );

-- 2. Store the slug on the question itself.
ALTER TABLE "questions" ADD COLUMN "category" VARCHAR(32);

UPDATE "questions" q
SET "category" = c."slug"
FROM "categories" c
WHERE q."category_id" = c."id";

ALTER TABLE "questions" ALTER COLUMN "category" SET NOT NULL;

ALTER TABLE "questions" ADD CONSTRAINT "questions_category_check" CHECK (
  "category" IN (
    'web-development', 'ai-data', 'cybersecurity', 'mobile-development',
    'software-engineering', 'career-studies', 'general'
  )
);

-- 3. Drop the old relation and table.
ALTER TABLE "questions" DROP CONSTRAINT "questions_category_id_fkey";
ALTER TABLE "questions" DROP COLUMN "category_id";
DROP TABLE "categories";
