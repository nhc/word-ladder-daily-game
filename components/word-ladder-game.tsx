"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, RotateCcw, Trophy, Clock } from "lucide-react";
import { toast } from "sonner";

// Dynamically import PixiJS to avoid SSR issues
const PixiGame = dynamic(() => import("./pixi-game"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
        <p className="text-sm text-muted-foreground">Loading game...</p>
      </div>
    </div>
  ),
});

interface Puzzle {
  id: string;
  date: string;
  difficulty: string;
  startWord: string;
  wordSequence: string[];
  clues: string[];
}

interface GameState {
  currentWord: string;
  currentStep: number;
  hintsUsed: number;
  completed: boolean;
  puzzle: Puzzle | null;
  loading: boolean;
}

interface WordLadderGameProps {
  difficulty: "easy" | "hard";
  onComplete: () => void;
  onBack: () => void;
}

export default function WordLadderGame({
  difficulty,
  onComplete,
  onBack,
}: WordLadderGameProps) {
  const [gameState, setGameState] = useState<GameState>({
    currentWord: "",
    currentStep: 0,
    hintsUsed: 0,
    completed: false,
    puzzle: null,
    loading: true,
  });

  const [highlightedLetter, setHighlightedLetter] = useState<number | null>(
    null
  );
  const [showLetterPicker, setShowLetterPicker] = useState<{
    index: number;
    letter: string;
  } | null>(null);

  // Fetch daily puzzle
  const fetchPuzzle = useCallback(async () => {
    try {
      setGameState((prev) => ({ ...prev, loading: true }));

      const response = await fetch(
        `/api/daily-puzzle?difficulty=${difficulty}`
      );
      if (!response.ok) throw new Error("Failed to fetch puzzle");

      const puzzle = await response.json();

      setGameState((prev) => ({
        ...prev,
        puzzle,
        currentWord: puzzle.startWord.toUpperCase(),
        currentStep: 0,
        hintsUsed: 0,
        completed: false,
        loading: false,
      }));
    } catch (error) {
      console.error("Error fetching puzzle:", error);
      toast.error("Failed to load puzzle. Please try again.");
      setGameState((prev) => ({ ...prev, loading: false }));
    }
  }, [difficulty]);

  useEffect(() => {
    fetchPuzzle();
  }, [fetchPuzzle]);

  const handleLetterClick = useCallback(
    async (letterIndex: number, newLetter: string) => {
      if (!gameState.puzzle || gameState.completed || gameState.loading) {
        return;
      }

      const currentWordArray = gameState.currentWord.split("");
      currentWordArray[letterIndex] = newLetter.toUpperCase();
      const newWord = currentWordArray.join("");

      // Validate the word change
      // The word sequence should include all words including the starting word
      // So if we're on step 0, we want wordSequence[1], if on step 1, we want wordSequence[2], etc.
      const expectedWord =
        gameState.puzzle.wordSequence[gameState.currentStep + 1];

      try {
        const response = await fetch("/api/validate-word", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            word: newWord.toLowerCase(),
            expectedWord: expectedWord.toLowerCase(),
          }),
        });

        const validation = await response.json();

        if (validation.isCorrect) {
          // Correct word!
          const nextStep = gameState.currentStep + 1;
          const isCompleted =
            nextStep >= gameState.puzzle.wordSequence.length - 1;

          setGameState((prev) => ({
            ...prev,
            currentWord: newWord,
            currentStep: nextStep,
            completed: isCompleted,
          }));

          if (isCompleted) {
            toast.success("Congratulations! Puzzle completed!", {
              icon: "🎉",
            });
            setTimeout(() => {
              onComplete();
            }, 2000);
          } else {
            toast.success("Correct! Moving to next clue.", {
              icon: "✅",
            });
          }
        } else if (!validation.isValidWord) {
          toast.error("Not a valid English word. Try again!");
        } else {
          toast.error("Close! But that's not the word we're looking for.");
        }
      } catch (error) {
        console.error("Error validating word:", error);
        toast.error("Error validating word. Please try again.");
      }
    },
    [gameState, onComplete]
  );

  const handleHint = useCallback(() => {
    if (
      !gameState.puzzle ||
      gameState.completed ||
      gameState.currentStep >= gameState.puzzle.wordSequence.length - 1
    )
      return;

    const currentWord = gameState.currentWord.toLowerCase();
    const targetWord =
      gameState.puzzle.wordSequence[gameState.currentStep + 1].toLowerCase();

    // Find the different letter
    for (let i = 0; i < currentWord.length; i++) {
      if (currentWord[i] !== targetWord[i]) {
        // Highlight the letter that needs to change
        setHighlightedLetter(i);

        setGameState((prev) => ({
          ...prev,
          hintsUsed: prev.hintsUsed + 1,
        }));

        toast.info(`Hint: Change the letter at position ${i + 1}`, {
          icon: "💡",
        });

        // Clear highlight after 3 seconds
        setTimeout(() => {
          setHighlightedLetter(null);
        }, 3000);

        return;
      }
    }
  }, [gameState]);

  const resetGame = useCallback(() => {
    fetchPuzzle();
  }, [fetchPuzzle]);

  if (gameState.loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">
              Loading Your Daily Puzzle
            </h3>
            <p className="text-muted-foreground">
              Generating a {difficulty} word ladder...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!gameState.puzzle) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">
              Unable to Load Puzzle
            </h3>
            <p className="text-muted-foreground mb-4">
              Please try again later.
            </p>
            <Button onClick={onBack}>Back to Menu</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentClue =
    gameState.currentStep < gameState.puzzle.clues.length
      ? gameState.puzzle.clues[gameState.currentStep]
      : null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Daily Word Ladder
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant={difficulty === "hard" ? "destructive" : "default"}
              >
                {difficulty.toUpperCase()}
              </Badge>
              <Badge variant="outline">
                Step {gameState.currentStep + 1}/6
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Game Area */}
      <Card>
        <CardContent className="p-6">
          {gameState.completed ? (
            <div className="text-center py-8">
              <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">
                Daily Puzzle Complete! 🎉
              </h2>
              <p className="text-muted-foreground mb-4">
                You completed the {difficulty} puzzle with {gameState.hintsUsed}{" "}
                hint{gameState.hintsUsed !== 1 ? "s" : ""} used!
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={onComplete}>Play Another</Button>
                <Button variant="outline" onClick={onBack}>
                  Back to Menu
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Temporary fallback while debugging PixiJS */}
              <div className="w-full h-96 bg-gray-800 rounded-lg flex items-center justify-center mb-4">
                <div className="text-white text-center">
                  <p className="text-lg mb-4">
                    Current Word: {gameState.currentWord}
                  </p>
                  <div className="flex gap-2 justify-center">
                    {gameState.currentWord.split("").map((letter, index) => (
                      <button
                        key={index}
                        className={`w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg border-2 ${
                          highlightedLetter === index
                            ? "border-yellow-400 bg-yellow-600"
                            : "border-blue-800"
                        }`}
                        onClick={() => {
                          setShowLetterPicker({ index, letter });
                        }}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm mt-4 text-gray-300">
                    Click a letter to change it
                  </p>
                </div>
              </div>

              {/* PixiJS Game - temporarily commented out for debugging */}
              {/* <PixiGame
                currentWord={gameState.currentWord}
                onLetterClick={handleLetterClick}
                highlightedLetter={highlightedLetter}
              /> */}

              {/* Letter Picker Modal */}
              {showLetterPicker && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                    <h3 className="text-lg font-semibold mb-4">
                      Change letter {showLetterPicker.index + 1} (
                      {showLetterPicker.letter})
                    </h3>
                    <div className="grid grid-cols-6 gap-2 mb-4">
                      {Array.from({ length: 26 }, (_, i) => {
                        const letter = String.fromCharCode(65 + i);
                        return (
                          <button
                            key={letter}
                            className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded border-2 border-blue-800"
                            onClick={() => {
                              handleLetterClick(showLetterPicker.index, letter);
                              setShowLetterPicker(null);
                            }}
                          >
                            {letter}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                      onClick={() => setShowLetterPicker(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {currentClue && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-2">Next word clue:</h3>
                  <p className="text-lg">{currentClue}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      {!gameState.completed && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleHint}
                  disabled={!currentClue}
                >
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Hint ({gameState.hintsUsed})
                </Button>
                <Button variant="outline" size="sm" onClick={resetGame}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={onBack}>
                Back to Menu
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
