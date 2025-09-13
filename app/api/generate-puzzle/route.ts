import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

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

    // Try to generate a valid puzzle with retries
    let puzzleData;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Puzzle generation attempt ${attempts}/${maxAttempts}`);

      const response = await fetch(
        "https://apps.abacus.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ABACUSAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
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
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate puzzle");
      }

      const data = await response.json();
      puzzleData = JSON.parse(data.choices[0].message.content);

      // Validate the puzzle data
      if (
        !puzzleData.startWord ||
        !puzzleData.wordSequence ||
        !puzzleData.clues
      ) {
        console.log(`Attempt ${attempts}: Invalid puzzle data structure`);
        continue;
      }

      // Check for duplicates in word sequence
      const uniqueWords = new Set(puzzleData.wordSequence);
      if (uniqueWords.size !== puzzleData.wordSequence.length) {
        console.log(
          `Attempt ${attempts}: Word sequence contains duplicates:`,
          puzzleData.wordSequence
        );
        continue;
      }

      // Check that startWord matches first word in sequence
      if (puzzleData.startWord !== puzzleData.wordSequence[0]) {
        console.log(
          `Attempt ${attempts}: Start word does not match first word in sequence`
        );
        continue;
      }

      // If we get here, the puzzle is valid
      console.log(
        `Valid puzzle generated on attempt ${attempts}:`,
        puzzleData.wordSequence
      );
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
