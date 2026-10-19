-- CreateEnum
CREATE TYPE "TitleSource" AS ENUM ('TMDB_MOVIE', 'TMDB_TV', 'JIKAN_ANIME');

-- CreateEnum
CREATE TYPE "TitleType" AS ENUM ('MOVIE', 'SERIES', 'ANIME');

-- CreateEnum
CREATE TYPE "WatchStatus" AS ENUM ('PLAN_TO_WATCH', 'WATCHING', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "Reaction" AS ENUM ('LIKED', 'DISLIKED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Title" (
    "id" UUID NOT NULL,
    "source" "TitleSource" NOT NULL,
    "externalId" INTEGER NOT NULL,
    "type" "TitleType" NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "posterUrl" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Title_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTitle" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "titleId" UUID NOT NULL,
    "status" "WatchStatus" NOT NULL DEFAULT 'PLAN_TO_WATCH',
    "reaction" "Reaction",
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "review" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTitle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Title_fetchedAt_idx" ON "Title"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Title_source_externalId_key" ON "Title"("source", "externalId");

-- CreateIndex
CREATE INDEX "UserTitle_userId_status_idx" ON "UserTitle"("userId", "status");

-- CreateIndex
CREATE INDEX "UserTitle_userId_reaction_idx" ON "UserTitle"("userId", "reaction");

-- CreateIndex
CREATE INDEX "UserTitle_userId_isFavorite_idx" ON "UserTitle"("userId", "isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "UserTitle_userId_titleId_key" ON "UserTitle"("userId", "titleId");

-- AddForeignKey
ALTER TABLE "UserTitle" ADD CONSTRAINT "UserTitle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTitle" ADD CONSTRAINT "UserTitle_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK written by hand: Prisma cannot express CHECK constraints in the schema.
-- Defense in depth: the Zod schema validates 1-10, but the DB also rejects it.
ALTER TABLE "UserTitle" ADD CONSTRAINT "UserTitle_rating_check" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 10);
