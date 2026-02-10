-- CreateEnum
CREATE TYPE "SeriesStatus" AS ENUM ('GENERATING', 'READY', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EpisodeStatus" AS ENUM ('GENERATING', 'VALIDATION_FAILED', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BeatType" AS ENUM ('HOOK', 'ESCALATION', 'TENSION', 'REVELATION', 'CLIFFHANGER');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "genre" TEXT NOT NULL,
    "contentText" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "estimatedPages" INTEGER NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "episodeCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SeriesStatus" NOT NULL DEFAULT 'GENERATING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drama_skeletons" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drama_skeletons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beats" (
    "id" TEXT NOT NULL,
    "dramaSkeleton_id" TEXT NOT NULL,
    "arcNumber" INTEGER NOT NULL,
    "beatType" "BeatType" NOT NULL,
    "description" TEXT NOT NULL,
    "narrativeNote" TEXT,
    "episodeStart" INTEGER NOT NULL,
    "episodeEnd" INTEGER NOT NULL,

    CONSTRAINT "beats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "scriptText" TEXT NOT NULL,
    "durationTargetSec" INTEGER NOT NULL DEFAULT 75,
    "estimatedReadTimeSec" INTEGER NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "hasCliffhanger" BOOLEAN NOT NULL DEFAULT false,
    "narratorRatioPct" INTEGER NOT NULL DEFAULT 0,
    "dialogueRatioPct" INTEGER NOT NULL DEFAULT 0,
    "status" "EpisodeStatus" NOT NULL DEFAULT 'GENERATING',
    "validationErrors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validationWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "narration" TEXT NOT NULL,
    "dialogue" TEXT,
    "characters" TEXT[],
    "sfxNotes" TEXT,
    "durationSec" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_traces" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "promptFull" TEXT NOT NULL,
    "responseText" TEXT,
    "estimatedTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "generationTimeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_stats" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "sentenceCount" INTEGER NOT NULL,
    "uniqueCharacterCount" INTEGER NOT NULL,
    "narratorWordCount" INTEGER NOT NULL,
    "dialogueWordCount" INTEGER NOT NULL,
    "avgWordsPerSentence" DOUBLE PRECISION NOT NULL,
    "readabilityScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "generation_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "books_workspaceId_idx" ON "books"("workspaceId");

-- CreateIndex
CREATE INDEX "series_bookId_idx" ON "series"("bookId");

-- CreateIndex
CREATE INDEX "series_workspaceId_idx" ON "series"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "drama_skeletons_seriesId_key" ON "drama_skeletons"("seriesId");

-- CreateIndex
CREATE INDEX "episodes_seriesId_idx" ON "episodes"("seriesId");

-- CreateIndex
CREATE INDEX "episodes_workspaceId_idx" ON "episodes"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_seriesId_episodeNumber_key" ON "episodes"("seriesId", "episodeNumber");

-- CreateIndex
CREATE INDEX "scenes_episodeId_idx" ON "scenes"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_traces_episodeId_key" ON "prompt_traces"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "generation_stats_episodeId_key" ON "generation_stats"("episodeId");

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series" ADD CONSTRAINT "series_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series" ADD CONSTRAINT "series_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drama_skeletons" ADD CONSTRAINT "drama_skeletons_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beats" ADD CONSTRAINT "beats_dramaSkeleton_id_fkey" FOREIGN KEY ("dramaSkeleton_id") REFERENCES "drama_skeletons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_traces" ADD CONSTRAINT "prompt_traces_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_stats" ADD CONSTRAINT "generation_stats_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
