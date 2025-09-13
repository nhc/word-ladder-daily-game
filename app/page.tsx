"use client";

import { useState, useEffect } from "react";
import { Toaster, toast } from "sonner";
import MainMenu from "@/components/main-menu";
import WordLadderGame from "@/components/word-ladder-game";

type GameState = "menu" | "playing";
type Difficulty = "easy" | "hard";

export default function HomePage() {
  const [gameState, setGameState] = useState<GameState>("menu");
  const [currentDifficulty, setCurrentDifficulty] =
    useState<Difficulty>("easy");

  const handleStartGame = (difficulty: Difficulty) => {
    setCurrentDifficulty(difficulty);
    setGameState("playing");
  };

  const handleGameComplete = () => {
    // Return to menu after completion
    setGameState("menu");
  };

  const handleBackToMenu = () => {
    setGameState("menu");
  };

  // Add click-to-dismiss functionality for toasts
  useEffect(() => {
    const handleToastClick = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-sonner-toast]")) {
        const toastElement = target.closest(
          "[data-sonner-toast]"
        ) as HTMLElement;
        const toastId = toastElement.getAttribute("data-toast-id");
        if (toastId) {
          toast.dismiss(toastId);
        } else {
          // Fallback: dismiss all toasts
          toast.dismiss();
        }
      }
    };

    document.addEventListener("click", handleToastClick);
    return () => document.removeEventListener("click", handleToastClick);
  }, []);

  return (
    <main className="min-h-screen">
      <Toaster
        position="top-center"
        richColors
        duration={4000}
        toastOptions={{
          style: {
            fontSize: "18px",
            padding: "16px 24px",
            minWidth: "300px",
            textAlign: "center",
            cursor: "pointer",
          },
          className: "toast-custom",
        }}
      />

      {gameState === "menu" ? (
        <MainMenu onStartGame={handleStartGame} />
      ) : (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 flex items-center justify-center">
          <WordLadderGame
            difficulty={currentDifficulty}
            onComplete={handleGameComplete}
            onBack={handleBackToMenu}
          />
        </div>
      )}
    </main>
  );
}
