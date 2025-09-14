import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

// Validate extra hard puzzles: same length words, exactly 2-3 letter changes per step
const validateExtraHardWordLadder = (wordSequence: string[]): boolean => {
  if (!Array.isArray(wordSequence) || wordSequence.length < 2) return false;

  for (const word of wordSequence) {
    if (typeof word !== "string") return false;
    if (word.length < 5 || word.length > 7) return false;
  }

  const firstLen = wordSequence[0].length;
  for (const word of wordSequence) {
    if (word.length !== firstLen) return false;
  }

  for (let i = 0; i < wordSequence.length - 1; i++) {
    const a = wordSequence[i].toLowerCase();
    const b = wordSequence[i + 1].toLowerCase();
    let diffs = 0;
    for (let j = 0; j < firstLen; j++) {
      if (a[j] !== b[j]) diffs++;
    }
    if (diffs < 2 || diffs > 3) return false;
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
    const systemPrompt = `You are an Extra Hard Word Ladder puzzle generator. Create a sequence of 6 words with these EXACT requirements:

1) ALL 6 words must be the SAME LENGTH (choose 5, 6, or 7 and keep that length for all words)
2) Each consecutive word must differ by EXACTLY 2 or 3 letters (Hamming distance, no insertions/deletions)
3) Valid English words only; no duplicates; avoid proper nouns, hyphens, or rare archaic forms
4) Avoid common starters like "house", "water", "light", "stone"

Before responding, SELF-CHECK:
- Start equals first item: startWord === wordSequence[0]
- Sequence has exactly 6 words; clues has exactly 5 items
- All words same length L in {5,6,7}
- For each adjacent pair, Hamming distance is 2 or 3
- All words are standard English words

Respond with ONLY valid JSON in this exact format (no backticks, no prose):
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
}`;

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
        model: "gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate an extra hard word ladder puzzle for ${date}. Choose a single word length (5, 6, or 7) and ensure ALL words stay that length. Each step must change EXACTLY 2 or 3 letters. Respond with ONLY valid JSON in the exact format specified.`,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1200,
      });

      {
        const raw = response.choices?.[0]?.message?.content ?? "";
        try {
          puzzleData = JSON.parse(raw);
        } catch (e) {
          const start = raw.indexOf("{");
          const end = raw.lastIndexOf("}");
          if (start !== -1 && end !== -1 && end > start) {
            const candidate = raw.slice(start, end + 1);
            puzzleData = JSON.parse(candidate);
          } else {
            console.log(
              `Attempt ${attempts}: Failed to parse JSON (raw length=${raw.length}).`
            );
            throw e;
          }
        }
      }

      // Validate the puzzle data
      if (
        !puzzleData.startWord ||
        !puzzleData.wordSequence ||
        !puzzleData.clues
      ) {
        console.log(`Attempt ${attempts}: Missing required fields`);
        continue;
      }

      // Check for duplicates in word sequence
      const uniqueWords = new Set(puzzleData.wordSequence);
      if (uniqueWords.size !== puzzleData.wordSequence.length) {
        console.log(`Attempt ${attempts}: Duplicate words found`);
        continue;
      }

      // Check that startWord matches first word in sequence
      if (puzzleData.startWord !== puzzleData.wordSequence[0]) {
        console.log(`Attempt ${attempts}: startWord doesn't match first word`);
        continue;
      }

      // Validate that each word differs by exactly 2-3 letters from the previous
      if (!validateExtraHardWordLadder(puzzleData.wordSequence)) {
        console.log(
          `Attempt ${attempts}: Extra hard word ladder validation failed for sequence:`,
          puzzleData.wordSequence
        );
        continue;
      }

      // If we get here, the puzzle is valid
      console.log(`Attempt ${attempts}: Valid extra hard puzzle generated!`);
      break;
    }

    if (attempts >= maxAttempts) {
      throw new Error(
        `Failed to generate valid extra hard puzzle after ${maxAttempts} attempts`
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
    console.error("Error generating extra hard puzzle:", error);
    return NextResponse.json(
      { error: "Failed to generate extra hard puzzle" },
      { status: 500 }
    );
  }
}
