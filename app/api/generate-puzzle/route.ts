import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

// Validate that each word differs by exactly 1 letter from the previous
const validateWordLadder = (wordSequence: string[]): boolean => {
  for (let i = 0; i < wordSequence.length - 1; i++) {
    const currentWord = wordSequence[i].toLowerCase();
    const nextWord = wordSequence[i + 1].toLowerCase();

    if (currentWord.length !== 5 || nextWord.length !== 5) {
      return false;
    }

    let differences = 0;
    for (let j = 0; j < 5; j++) {
      if (currentWord[j] !== nextWord[j]) {
        differences++;
      }
    }

    if (differences !== 1) {
      return false;
    }
  }
  return true;
};

export async function POST(request: NextRequest) {
  try {
    const { date, difficulty } = await request.json();

    if (!date || !difficulty) {
      return NextResponse.json(
        { error: "Date and difficulty are required" },
        { status: 400 }
      );
    }

    // Check if puzzle already exists for this date and difficulty
    const existingPuzzle = await prisma.dailyPuzzle.findFirst({
      where: {
        date,
        difficulty,
      },
    });

    if (existingPuzzle) {
      return NextResponse.json(existingPuzzle);
    }

    // Generate new puzzle using LLM
    const systemPrompt = `You are a Word Ladder puzzle generator. Create a sequence of 6 five-letter English words where each word differs from the previous by exactly one letter. 

For ${difficulty} difficulty:
- Easy: Use common, everyday words that most people would know
- Hard: Use more challenging vocabulary, proper nouns, or less common words

Generate a valid word ladder sequence and provide a clue for each transformation (except the starting word). Each clue should clearly describe the target word without being too obvious.

IMPORTANT RULES:
- Each word must be exactly 5 letters
- Each consecutive word must differ by exactly 1 letter
- NO DUPLICATE WORDS in the sequence
- The wordSequence should include ALL 6 words including the startWord
- wordSequence[0] = startWord, wordSequence[1] = first target, etc.

Respond with clean JSON only in this exact format:
{
  "startWord": "first word",
  "wordSequence": ["word1", "word2", "word3", "word4", "word5", "word6"],
  "clues": [
    "Clue for word2",
    "Clue for word3", 
    "Clue for word4",
    "Clue for word5",
    "Clue for word6"
  ]
}

Example of a correct sequence:
- startWord: "plant"
- wordSequence: ["plant", "plane", "plate", "blate", "blaze", "blame"]
- Each word differs from the previous by exactly 1 letter`;

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPEN_AI_API_KEY,
    });

    // Try to generate a valid puzzle with retries
    let puzzleData;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate a ${difficulty} word ladder puzzle for ${date}`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.7,
      });

      puzzleData = JSON.parse(response.choices[0].message.content!);

      // Validate the puzzle data
      if (
        !puzzleData.startWord ||
        !puzzleData.wordSequence ||
        !puzzleData.clues
      ) {
        continue;
      }

      // Check for duplicates in word sequence
      const uniqueWords = new Set(puzzleData.wordSequence);
      if (uniqueWords.size !== puzzleData.wordSequence.length) {
        continue;
      }

      // Check that startWord matches first word in sequence
      if (puzzleData.startWord !== puzzleData.wordSequence[0]) {
        continue;
      }

      // Validate that each word differs by exactly 1 letter from the previous
      if (!validateWordLadder(puzzleData.wordSequence)) {
        continue;
      }

      // If we get here, the puzzle is valid
      break;
    }

    if (attempts >= maxAttempts) {
      throw new Error(
        `Failed to generate valid puzzle after ${maxAttempts} attempts`
      );
    }

    // Save puzzle to database
    const puzzle = await prisma.dailyPuzzle.create({
      data: {
        date,
        difficulty,
        startWord: puzzleData.startWord,
        wordSequence: puzzleData.wordSequence,
        clues: puzzleData.clues,
      },
    });

    return NextResponse.json(puzzle);
  } catch (error) {
    console.error("Error generating puzzle:", error);
    return NextResponse.json(
      { error: "Failed to generate puzzle" },
      { status: 500 }
    );
  }
}
