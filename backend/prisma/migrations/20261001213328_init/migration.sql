-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MODERATOR', 'HOST');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('PENDING', 'MODERATOR_APPROVED', 'REJECTED', 'HOST_APPROVED', 'DISPLAYED', 'ANSWERED');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('PRE_EVENT', 'LIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "display_name" VARCHAR(50),
    "participant_session_id" UUID NOT NULL,
    "source" "QuestionSource" NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moderator_approved_at" TIMESTAMP(3),
    "moderator_rejected_at" TIMESTAMP(3),
    "host_approved_at" TIMESTAMP(3),
    "host_rejected_at" TIMESTAMP(3),
    "displayed_at" TIMESTAMP(3),
    "answered_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "submissions_open" BOOLEAN NOT NULL DEFAULT true,
    "ended_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "questions_status_idx" ON "questions"("status");

-- CreateIndex
CREATE INDEX "questions_participant_session_id_created_at_idx" ON "questions"("participant_session_id", "created_at");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- At most one question can be on the presentation screen at any time.
CREATE UNIQUE INDEX "questions_single_displayed" ON "questions" ("status") WHERE "status" = 'DISPLAYED';

-- event_state is a single-row table.
ALTER TABLE "event_state" ADD CONSTRAINT "event_state_single_row" CHECK ("id" = 1);
INSERT INTO "event_state" ("id", "submissions_open", "updated_at") VALUES (1, true, CURRENT_TIMESTAMP);
