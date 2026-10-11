-- Software Engineering leaves the fixed topic list (src/common/categories.ts).
-- Its questions are deleted, like those of the topics removed before it.
DELETE FROM "questions" WHERE "category" = 'software-engineering';

ALTER TABLE "questions" DROP CONSTRAINT "questions_category_check";
ALTER TABLE "questions" ADD CONSTRAINT "questions_category_check" CHECK (
  "category" IN (
    'general', 'career-studies', 'ai-data', 'web-development', 'cybersecurity',
    'mobile-development'
  )
);
