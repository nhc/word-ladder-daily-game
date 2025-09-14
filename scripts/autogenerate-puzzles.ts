import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

const prisma = new PrismaClient();

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

// Validate that each word differs by 2-3 letters from the previous
const validateExtraHardWordLadder = (wordSequence: string[]): boolean => {
  // Check that all words are between 5-7 letters
  for (const word of wordSequence) {
    if (word.length < 5 || word.length > 7) {
      return false;
    }
  }

  // Check that all words in the sequence have the same length
  const firstWordLength = wordSequence[0].length;
  for (const word of wordSequence) {
    if (word.length !== firstWordLength) {
      return false;
    }
  }

  // Now validate that each word differs by 2-3 letters from the previous
  for (let i = 0; i < wordSequence.length - 1; i++) {
    const currentWord = wordSequence[i].toLowerCase();
    const nextWord = wordSequence[i + 1].toLowerCase();

    let differences = 0;
    // Count differences in each position (all words same length now)
    for (let j = 0; j < firstWordLength; j++) {
      if (currentWord[j] !== nextWord[j]) {
        differences++;
      }
    }

    // Must differ by exactly 2 or 3 letters
    if (differences < 2 || differences > 3) {
      return false;
    }
  }
  return true;
};

// Diagnostics for extra-hard validation failures
const analyzeExtraHardSequence = (wordSequence: string[]) => {
  const lengths = wordSequence.map((w) => w.length);
  const firstLen = lengths[0];
  const sameLength =
    lengths.every((l) => l === firstLen) && firstLen >= 5 && firstLen <= 7;

  const pairDiffs: number[] = [];
  if (sameLength) {
    for (let i = 0; i < wordSequence.length - 1; i++) {
      const a = wordSequence[i].toLowerCase();
      const b = wordSequence[i + 1].toLowerCase();
      let diffs = 0;
      for (let j = 0; j < firstLen; j++) {
        if (a[j] !== b[j]) diffs++;
      }
      pairDiffs.push(diffs);
    }
  }

  let reason = "unknown";
  if (!sameLength) {
    reason = "NON_UNIFORM_LENGTH";
  } else {
    const outOfRange = pairDiffs.some((d) => d < 2 || d > 3);
    if (outOfRange) reason = "DIFF_OUT_OF_RANGE";
  }

  return { lengths, sameLength, pairDiffs, reason };
};

const generatePuzzle = async (
  date: string,
  difficulty: string,
  isExtraHard: boolean = false
) => {
  const systemPrompt = isExtraHard
    ? `You are an Extra Hard Word Ladder puzzle generator. Create a sequence of 6 words with these EXACT requirements:

🎯 CRITICAL REQUIREMENTS (MUST FOLLOW EXACTLY):
1. ALL 6 words must be the SAME LENGTH (choose 5, 6, or 7 letters for the entire sequence)
2. Each consecutive word must differ by EXACTLY 2 or 3 letters (no more, no less)
3. NO duplicate words in the sequence
4. Use challenging vocabulary, less common words

📝 STEP-BY-STEP PROCESS:
1. Choose a word length (5, 6, or 7 letters) for the entire sequence
2. Pick a starting word of that length
3. For each next word, change EXACTLY 2 or 3 letters from the previous word
4. Ensure all words are valid English words
5. Avoid common words like "house", "water", "light", "stone"

✅ CORRECT EXAMPLES:
- 6-letter sequence: "castle" → "battle" (c→b, s→t = 2 changes), "battle" → "bottle" (a→o, t→t = 2 changes)
- 5-letter sequence: "light" → "night" (l→n = 1 change) ❌ TOO FEW
- 5-letter sequence: "light" → "fight" (l→f = 1 change) ❌ TOO FEW  
- 5-letter sequence: "light" → "might" (l→m = 1 change) ❌ TOO FEW
- 5-letter sequence: "light" → "tight" (l→t = 1 change) ❌ TOO FEW

❌ WRONG EXAMPLES:
- "castle" → "cattle" (only 1 change: s→t) ❌
- "castle" → "button" (5 changes: c→b, a→u, s→t, t→t, l→o, e→n) ❌
- Mixed lengths: ["castle", "cat"] ❌

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
}`
    : `You are a Word Ladder puzzle generator. Create a sequence of 6 five-letter English words where each word differs from the previous by exactly one letter. 

For ${difficulty} difficulty:
- Easy: Use common, everyday words that most people would know (like: house, water, light, table, chair, etc.)
- Hard: Use more challenging vocabulary, less common words, or words that require more thought (like: quirk, fjord, glyph, etc.)

IMPORTANT: Choose a completely different starting word than common words like "stone", "light", "house", "water". Be creative and varied!

Generate a valid word ladder sequence and provide a clue for each transformation (except the starting word). Each clue should clearly describe the target word without being too obvious.

CRITICAL VALIDATION RULES:
- Each word must be exactly 5 letters
- Each consecutive word must differ by exactly 1 letter (only one position can change)
- NO DUPLICATE WORDS in the sequence
- The wordSequence should include ALL 6 words including the startWord
- wordSequence[0] = startWord, wordSequence[1] = first target, etc.
- Example: "plant" → "plane" (only 't' changes to 'e'), "plane" → "plate" (only 'n' changes to 't')

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
  const maxAttempts = 8;

  while (attempts < maxAttempts) {
    attempts++;

    // Add a small delay between attempts to avoid rate limiting
    if (attempts > 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const baseParams: any = {
      model: isExtraHard ? "gpt-5" : "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: isExtraHard
            ? `Generate an extra-hard word ladder puzzle for ${date}. Choose a word length (5, 6, or 7 letters) and create a sequence where each word differs by EXACTLY 2 or 3 letters from the previous word. Use challenging vocabulary. Respond with ONLY valid JSON in the exact format specified.`
            : `Generate a ${difficulty} word ladder puzzle for ${date}. Use a unique starting word that's different from common words. Be creative! Respond with ONLY valid JSON in the exact format specified.`,
        },
      ],
      response_format: { type: "json_object" },
    };

    if (isExtraHard) {
      baseParams.max_completion_tokens = 1200;
    } else {
      baseParams.max_tokens = 1000;
      baseParams.temperature = 0.7 + attempts * 0.1;
    }

    const response = await openai.chat.completions.create(baseParams);

    const raw = response.choices?.[0]?.message?.content ?? "";
    try {
      puzzleData = JSON.parse(raw);
    } catch (e) {
      // Attempt to salvage JSON by trimming to first '{' and last '}'
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        const candidate = raw.slice(start, end + 1);
        try {
          puzzleData = JSON.parse(candidate);
        } catch (e2) {
          console.log(
            `Attempt ${attempts}: Failed to parse JSON (raw length=${raw.length}).`
          );
          throw e2;
        }
      } else {
        console.log(
          `Attempt ${attempts}: Missing JSON object in response (raw length=${raw.length}).`
        );
        throw e;
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

    // Validate word ladder based on difficulty
    const isValid = isExtraHard
      ? validateExtraHardWordLadder(puzzleData.wordSequence)
      : validateWordLadder(puzzleData.wordSequence);

    if (!isValid) {
      if (isExtraHard) {
        const diag = analyzeExtraHardSequence(puzzleData.wordSequence);
        console.log(
          `Attempt ${attempts}: Word ladder validation failed for sequence:`,
          puzzleData.wordSequence
        );
        console.log(
          `  ↳ Diagnostics: reason=${diag.reason}, lengths=${JSON.stringify(
            diag.lengths
          )}, diffs=${JSON.stringify(diag.pairDiffs)}`
        );
      } else {
        console.log(
          `Attempt ${attempts}: Word ladder validation failed for sequence:`,
          puzzleData.wordSequence
        );
      }
      continue;
    }

    // If we get here, the puzzle is valid
    console.log(`Attempt ${attempts}: Valid ${difficulty} puzzle generated!`);
    break;
  }

  if (attempts >= maxAttempts) {
    throw new Error(
      `Failed to generate valid ${difficulty} puzzle after ${maxAttempts} attempts`
    );
  }

  return puzzleData;
};

const generateDateRange = (startDate: Date, days: number): string[] => {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date.toISOString().split("T")[0]);
  }
  return dates;
};

async function main() {
  const toIso = (d: Date) => d.toISOString().split("T")[0];
  const mode = process.argv[2];
  const input = process.argv[3];

  const resolveDateStr = (a?: string): string | null => {
    if (!a) {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      return toIso(t);
    }
    if (a === "today") return toIso(new Date());
    if (a === "tomorrow") {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      return toIso(t);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(a)) return a;
    return null;
  };

  let dates: string[] = [];
  if (mode === "week") {
    const baseStr = resolveDateStr(input);
    if (!baseStr) {
      console.log(
        `⚠️  Unrecognized date argument: "${input}". Use: pnpm puzzles:generate week [YYYY-MM-DD|today|tomorrow]`
      );
      return;
    }
    const base = new Date(baseStr);
    dates = generateDateRange(base, 7);
    console.log(
      `🚀 Starting puzzle autogeneration for a week from ${baseStr}...`
    );
  } else {
    const targetDateStr = resolveDateStr(mode);
    if (!targetDateStr) {
      console.log(
        `⚠️  Unrecognized date argument: "${mode}". Use YYYY-MM-DD | today | tomorrow | week [date]`
      );
      return;
    }
    dates = [targetDateStr];
    console.log("🚀 Starting puzzle autogeneration for a single day...");
  }

  const difficulties = [
    { name: "easy", isExtraHard: false },
    { name: "hard", isExtraHard: false },
    { name: "extra-hard", isExtraHard: true },
  ];

  let totalGenerated = 0;
  let totalSkipped = 0;

  for (const date of dates) {
    console.log(`\n📅 Generating puzzles for ${date}:`);

    for (const difficulty of difficulties) {
      // Check if puzzle already exists
      const existingPuzzle = await prisma.dailyPuzzle.findFirst({
        where: {
          date,
          difficulty: difficulty.name,
        },
      });

      if (existingPuzzle) {
        console.log(
          `  ⏭️  ${difficulty.name} puzzle already exists for ${date}`
        );
        totalSkipped++;
        continue;
      }

      console.log(`  🔄 Generating ${difficulty.name} puzzle...`);

      // Retry until successful
      let success = false;
      let retryCount = 0;
      const maxRetries = 10;

      while (!success && retryCount < maxRetries) {
        try {
          // Generate the puzzle
          const puzzleData = await generatePuzzle(
            date,
            difficulty.name,
            difficulty.isExtraHard
          );

          // Save puzzle to database
          const puzzle = await prisma.dailyPuzzle.create({
            data: {
              date,
              difficulty: difficulty.name,
              startWord: puzzleData.startWord,
              wordSequence: puzzleData.wordSequence,
              clues: puzzleData.clues,
            },
          });

          console.log(
            `  ✅ Created ${difficulty.name} puzzle: ${
              puzzleData.startWord
            } → ${puzzleData.wordSequence[puzzleData.wordSequence.length - 1]}`
          );
          totalGenerated++;
          success = true;
        } catch (error) {
          retryCount++;
          const message =
            error instanceof Error ? error.message : String(error);
          console.log(
            `  ⚠️  Attempt ${retryCount} failed for ${difficulty.name} puzzle: ${message}`
          );

          if (retryCount < maxRetries) {
            console.log(
              `  🔄 Retrying ${difficulty.name} puzzle (${retryCount}/${maxRetries})...`
            );
            // Add delay between retries
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } else {
            console.error(
              `  ❌ Failed to generate ${difficulty.name} puzzle for ${date} after ${maxRetries} attempts`
            );
          }
        }
      }
    }
  }

  console.log(`\n🎉 Autogeneration completed!`);
  console.log(`📊 Summary:`);
  console.log(`   • Generated: ${totalGenerated} puzzles`);
  console.log(`   • Skipped: ${totalSkipped} puzzles (already existed)`);
  console.log(`   • Total dates processed: ${dates.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Script failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
