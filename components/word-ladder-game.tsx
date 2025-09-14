"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, RotateCcw, Trophy, Clock } from "lucide-react";
import MessageModal from "./message-modal";

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
  difficulty: "easy" | "hard" | "extra-hard";
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

  // For extra hard mode: track which letters need to be changed
  const [lettersToChange, setLettersToChange] = useState<Set<number>>(
    new Set()
  );
  const [currentLetterIndex, setCurrentLetterIndex] = useState<number | null>(
    null
  );
  const [showHintLetters, setShowHintLetters] = useState<boolean>(false);

  // Calculate which letters need to be changed for extra hard mode
  const calculateLettersToChange = useCallback(() => {
    if (
      difficulty !== "extra-hard" ||
      !gameState.puzzle ||
      gameState.completed
    ) {
      return;
    }

    const currentWord = gameState.currentWord.toLowerCase();
    const targetWord =
      gameState.puzzle.wordSequence[gameState.currentStep + 1].toLowerCase();

    const lettersToChangeSet = new Set<number>();

    // Find the minimum length to compare
    const minLength = Math.min(currentWord.length, targetWord.length);

    // Check each position
    for (let i = 0; i < minLength; i++) {
      if (currentWord[i] !== targetWord[i]) {
        lettersToChangeSet.add(i);
      }
    }

    // Add positions for extra characters in longer word
    if (currentWord.length > targetWord.length) {
      for (let i = minLength; i < currentWord.length; i++) {
        lettersToChangeSet.add(i);
      }
    } else if (targetWord.length > currentWord.length) {
      for (let i = minLength; i < targetWord.length; i++) {
        lettersToChangeSet.add(i);
      }
    }

    setLettersToChange(lettersToChangeSet);
  }, [
    difficulty,
    gameState.puzzle,
    gameState.currentWord,
    gameState.currentStep,
    gameState.completed,
  ]);

  // Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: "success" | "error" | "info";
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

  // Helper function to show modal
  const showModal = (
    type: "success" | "error" | "info",
    title: string,
    message: string
  ) => {
    setModalState({
      isOpen: true,
      type,
      title,
      message,
    });
  };

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

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
      showModal("error", "Failed to Load Puzzle", "Please try again.");
      setGameState((prev) => ({ ...prev, loading: false }));
    }
  }, [difficulty]);

  useEffect(() => {
    fetchPuzzle();
  }, [fetchPuzzle]);

  // Calculate letters to change when game state changes
  useEffect(() => {
    calculateLettersToChange();
  }, [calculateLettersToChange]);

  const handleLetterClick = useCallback(
    async (letterIndex: number, newLetter: string) => {
      if (!gameState.puzzle || gameState.completed || gameState.loading) {
        return;
      }

      const currentWordArray = gameState.currentWord.split("");
      currentWordArray[letterIndex] = newLetter.toUpperCase();
      const newWord = currentWordArray.join("");

      // For extra hard mode, check if this single change gets us closer to the target
      if (difficulty === "extra-hard") {
        const targetWord =
          gameState.puzzle.wordSequence[
            gameState.currentStep + 1
          ].toLowerCase();

        // Update the current word
        setGameState((prev) => ({
          ...prev,
          currentWord: newWord,
        }));

        // Check if we've reached the target word
        if (newWord.toLowerCase() === targetWord) {
          const nextStep = gameState.currentStep + 1;
          const isCompleted =
            nextStep >= gameState.puzzle.wordSequence.length - 1;

          setGameState((prev) => ({
            ...prev,
            currentStep: nextStep,
            completed: isCompleted,
          }));

          // Reset hint state for extra hard mode when advancing to next step
          if (difficulty === "extra-hard") {
            setShowHintLetters(false);
          }

          if (isCompleted) {
            showModal("success", "Congratulations! 🎉", "Puzzle completed!");
            setTimeout(() => {
              onComplete();
            }, 2000);
          } else {
            showModal("success", "Great! 🎯", "Correct word! Keep going!");
            setTimeout(() => {
              closeModal();
            }, 1500);
          }
        } else {
          // For extra hard mode, check if this change gets us closer to the target
          const currentWord = gameState.currentWord.toLowerCase();
          const targetWord =
            gameState.puzzle.wordSequence[
              gameState.currentStep + 1
            ].toLowerCase();

          // Count how many letters match the target in the original word
          const originalMatches = currentWord
            .split("")
            .reduce((count, letter, index) => {
              return count + (letter === targetWord[index] ? 1 : 0);
            }, 0);

          // Count how many letters match the target in the new word
          const newMatches = newWord
            .toLowerCase()
            .split("")
            .reduce((count, letter, index) => {
              return count + (letter === targetWord[index] ? 1 : 0);
            }, 0);

          if (newMatches > originalMatches) {
            // This change gets us closer to the target
            showModal(
              "info",
              "Good progress! 📝",
              "Keep changing letters to reach the target word."
            );
          } else if (newMatches === originalMatches) {
            // This change doesn't help or hurt
            showModal(
              "info",
              "No change 📝",
              "This letter change doesn't get you closer to the target word."
            );
          } else {
            // This change makes us further from the target
            // Revert the change
            setGameState((prev) => ({
              ...prev,
              currentWord: gameState.currentWord,
            }));
            showModal(
              "error",
              "Wrong direction! ❌",
              "This letter change takes you away from the target word. Try a different letter."
            );
          }
        }
      } else {
        // Original logic for easy/hard mode
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
            const nextStep = gameState.currentStep + 1;
            const isCompleted =
              nextStep >= gameState.puzzle.wordSequence.length - 1;

            setGameState((prev) => ({
              ...prev,
              currentWord: newWord,
              currentStep: nextStep,
              completed: isCompleted,
            }));

            // Reset hint state for extra hard mode when advancing to next step
            if (difficulty === "extra-hard") {
              setShowHintLetters(false);
            }

            if (isCompleted) {
              showModal("success", "Congratulations! 🎉", "Puzzle completed!");
              setTimeout(() => {
                onComplete();
              }, 2000);
            } else {
              showModal("success", "Correct! ✅", "Moving to next clue.");
            }
          } else if (!validation.isValidWord) {
            showModal(
              "error",
              "Invalid Word",
              "Not a valid English word. Try again!"
            );
          } else {
            showModal(
              "error",
              "Close!",
              "But that's not the word we're looking for."
            );
          }
        } catch (error) {
          console.error("Error validating word:", error);
          showModal(
            "error",
            "Validation Error",
            "Error validating word. Please try again."
          );
        }
      }
    },
    [gameState, onComplete, difficulty, showModal, closeModal]
  );

  const handleHint = useCallback(() => {
    if (
      !gameState.puzzle ||
      gameState.completed ||
      gameState.currentStep >= gameState.puzzle.wordSequence.length - 1
    )
      return;

    if (difficulty === "extra-hard") {
      // For extra hard mode, show which letters need to be changed
      setShowHintLetters(true);
      setGameState((prev) => ({
        ...prev,
        hintsUsed: prev.hintsUsed + 1,
      }));
    } else {
      // For easy/hard mode, highlight the single letter that needs to change
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

          showModal(
            "info",
            "Hint 💡",
            `Change the letter at position ${i + 1}`
          );

          // Clear highlight after 3 seconds
          setTimeout(() => {
            setHighlightedLetter(null);
          }, 3000);

          return;
        }
      }
    }
  }, [gameState, difficulty]);

  const resetGame = useCallback(() => {
    // Reset extra hard mode state
    setLettersToChange(new Set());
    setCurrentLetterIndex(null);
    setShowHintLetters(false);
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
            <button
              onClick={onBack}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              <CardTitle className="text-sm sm:text-base">
                Daily Word Ladder
              </CardTitle>
            </button>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  difficulty === "hard"
                    ? "destructive"
                    : difficulty === "extra-hard"
                    ? "destructive"
                    : "default"
                }
              >
                {difficulty === "extra-hard"
                  ? "EXTRA HARD"
                  : difficulty.toUpperCase()}
              </Badge>
              <Badge variant="outline">
                Step {gameState.currentStep + 1}/6
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Game Area with Overlay Controls */}
      <Card className="relative">
        <CardContent className="p-2 md:p-6 pb-20">
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
              {/* Word Box with Controls */}
              <div className="relative w-full h-96 bg-gray-800 rounded-lg mb-4">
                {/* Main word display */}
                <div className="flex items-center justify-center h-full">
                  <div className="text-white text-center">
                    <p className="text-lg mb-4">
                      Current Word:{" "}
                      {gameState.puzzle?.wordSequence[gameState.currentStep]}
                    </p>
                    <div className="flex gap-2 justify-center">
                      {gameState.currentWord.split("").map((letter, index) => (
                        <button
                          key={index}
                          className={`w-12 h-12 font-bold rounded-lg border-2 ${
                            highlightedLetter === index
                              ? "border-yellow-400 bg-yellow-600 text-white"
                              : difficulty === "extra-hard" &&
                                showHintLetters &&
                                lettersToChange.has(index)
                              ? "border-purple-400 bg-purple-600 text-white hover:bg-purple-700"
                              : "border-blue-800 bg-blue-600 text-white hover:bg-blue-700"
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
                      {difficulty === "extra-hard"
                        ? `Click a purple letter to change it (${lettersToChange.size} letters need changing)`
                        : "Click a letter to change it"}
                    </p>
                  </div>
                </div>

                {/* Controls Panel at Bottom */}
                {!gameState.completed && (
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-black/80 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex gap-3 sm:gap-2 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleHint}
                        disabled={!currentClue}
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        <Lightbulb className="h-4 w-4 mr-2" />
                        Hint ({gameState.hintsUsed})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetGame}
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onBack}
                      className="text-white hover:bg-white/20 hidden md:flex"
                    >
                      Back to Menu
                    </Button>
                  </div>
                )}
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

      {/* Message Modal */}
      <MessageModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        autoClose={modalState.type === "success"}
        autoCloseDelay={2000}
      />
    </div>
  );
}
