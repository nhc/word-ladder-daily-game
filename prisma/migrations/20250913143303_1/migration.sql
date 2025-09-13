-- CreateTable
CREATE TABLE "daily_puzzles" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "startWord" TEXT NOT NULL,
    "wordSequence" JSONB NOT NULL,
    "clues" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_puzzles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_puzzles_date_difficulty_key" ON "daily_puzzles"("date", "difficulty");
