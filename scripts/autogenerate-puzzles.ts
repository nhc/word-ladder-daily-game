import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { promises as fsp } from "node:fs";
import path from "node:path";

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

const getHammingDistance = (a: string, b: string): number => {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
};

const pickLengthForAttempt = (attempt: number): number => {
  const options = [6, 5, 7];
  return options[attempt % options.length];
};

const writeFailureLog = async (entry: any) => {
  try {
    const baseDir = path.join(process.cwd(), "logs", "puzzle_failures");
    await fsp.mkdir(baseDir, { recursive: true });
    const dateDir = path.join(baseDir, String(entry.date));
    await fsp.mkdir(dateDir, { recursive: true });
    const file = path.join(
      dateDir,
      `${entry.difficulty}-${entry.attempt}-${Date.now()}.json`
    );
    await fsp.writeFile(file, JSON.stringify(entry, null, 2), "utf8");
  } catch {}
};

// Load filtered words data
let filteredWordsCache: any = null;
const loadFilteredWords = async () => {
  if (!filteredWordsCache) {
    const wordsPath = path.join(process.cwd(), "data", "filtered_words.json");
    const wordsData = await fsp.readFile(wordsPath, "utf8");
    filteredWordsCache = JSON.parse(wordsData);
  }
  return filteredWordsCache;
};

// Deterministic extra-hard puzzle generation using filtered words
const generateDeterministicExtraHardPuzzle = async (
  date: string,
  targetLength: 5 | 6 = 6,
  seedModifier: number = 0
): Promise<{ startWord: string; wordSequence: string[]; clues: string[] }> => {
  const wordsData = await loadFilteredWords();
  const words: string[] = wordsData[`length_${targetLength}`] || [];

  if (words.length === 0) {
    throw new Error(`No words found for length ${targetLength}`);
  }

  // Create a seeded random generator based on date for reproducibility
  const seedFromDate = (dateStr: string, modifier: number = 0): number => {
    let hash = 0;
    const combined = dateStr + modifier.toString();
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash + combined.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash);
  };

  const seed = seedFromDate(date, seedModifier);
  let randomState = seed;
  const seededRandom = () => {
    randomState = (randomState * 1664525 + 1013904223) % 4294967296;
    return randomState / 4294967296;
  };

  // Enhanced starting word selection
  const analyzeWordConnectivity = (
    word: string,
    wordList: string[]
  ): number => {
    let connections = 0;
    for (const otherWord of wordList) {
      if (
        otherWord !== word &&
        getHammingDistance(word, otherWord) >= 2 &&
        getHammingDistance(word, otherWord) <= 3
      ) {
        connections++;
      }
    }
    return connections;
  };

  const scoreStartingWord = (word: string, wordList: string[]): number => {
    let score = 0;

    // Factor 1: Connectivity (30% weight) - how many valid next words
    const connectivity = analyzeWordConnectivity(word, wordList);
    score += connectivity * 0.3;

    // Factor 2: Letter diversity (20% weight) - prefer words with varied letters
    const uniqueLetters = new Set(word.split("")).size;
    score += (uniqueLetters / word.length) * 20;

    // Factor 3: Vowel balance (15% weight) - prefer words with good vowel/consonant balance
    const vowels = word.match(/[aeiou]/gi)?.length || 0;
    const idealVowelRatio = word.length <= 5 ? 0.4 : 0.35; // Ideal ratio
    const vowelRatio = vowels / word.length;
    const vowelScore = 1 - Math.abs(vowelRatio - idealVowelRatio);
    score += vowelScore * 15;

    // Factor 4: Avoid repetitive patterns (10% weight)
    const hasRepeats = /(.)\1/.test(word);
    if (!hasRepeats) score += 10;

    // Factor 5: Common letter positions (25% weight) - letters that often appear in English
    const commonStart = /^[bcdfghjklmnpqrstvwxyz]/.test(word) ? 5 : 0;
    const commonEnd = /[strdnly]$/.test(word) ? 5 : 0;
    score += (commonStart + commonEnd) * 0.25;

    return score;
  };

  // Create scored word list for smarter selection
  const scoredWords = words
    .map((word) => ({
      word,
      score: scoreStartingWord(word, words),
      connectivity: analyzeWordConnectivity(word, words),
    }))
    .sort((a, b) => b.score - a.score);

  // Take top candidates but add some randomization
  const topCandidates = scoredWords.slice(
    0,
    Math.min(200, Math.floor(words.length * 0.3))
  );
  const shuffledWords = [...topCandidates];
  for (let i = shuffledWords.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [shuffledWords[i], shuffledWords[j]] = [shuffledWords[j], shuffledWords[i]];
  }

  // Find a valid sequence of 6 words
  const findValidSequence = (
    startWord: string,
    usedWords: Set<string>,
    currentSequence: string[],
    maxLength: number = 6
  ): string[] | null => {
    if (currentSequence.length === maxLength) {
      return currentSequence;
    }

    const lastWord = currentSequence[currentSequence.length - 1];

    // Find words that differ by 2-3 letters from the last word
    for (const candidate of shuffledWords) {
      const candidateWord = candidate.word;
      if (usedWords.has(candidateWord)) continue;

      const hammingDist = getHammingDistance(lastWord, candidateWord);
      if (hammingDist >= 2 && hammingDist <= 3) {
        const newUsed = new Set(usedWords);
        newUsed.add(candidateWord);
        const newSequence = [...currentSequence, candidateWord];

        const result = findValidSequence(
          startWord,
          newUsed,
          newSequence,
          maxLength
        );
        if (result) {
          return result;
        }
      }
    }

    return null;
  };

  // Try different starting words until we find a valid sequence
  for (
    let startIndex = 0;
    startIndex < Math.min(shuffledWords.length, 50);
    startIndex++
  ) {
    const candidate = shuffledWords[startIndex];
    const startWord = candidate.word;
    const usedWords = new Set([startWord]);
    const sequence = findValidSequence(startWord, usedWords, [startWord]);

    if (startIndex === 0) {
      console.log(
        `  📊 Best starting word candidate: "${startWord}" (score: ${candidate.score.toFixed(
          1
        )}, connectivity: ${candidate.connectivity})`
      );
    }

    if (sequence && sequence.length === 6) {
      console.log(
        `✅ Found valid deterministic sequence: ${sequence.join(" → ")}`
      );

      // Now generate clues using OpenAI
      const openai = new OpenAI({
        apiKey: process.env.OPEN_AI_API_KEY,
      });

      const cluePrompt = `Generate high-quality clues for an EXTRA-HARD word ladder puzzle. You need to provide exactly 5 clues for the word transformations below.

Sequence: ${sequence.join(" → ")}

CRITICAL REQUIREMENTS:
1. First, verify you understand the EXACT MEANING of each target word (some may be uncommon)
2. Each clue must describe the TARGET word (not the starting word)
3. Clues should be 4-12 words long and descriptively rich
4. Must NOT contain any letters from the target word itself
5. Since this is EXTRA-HARD, words may be uncommon - provide clear, detailed definitions
6. Each clue should give enough context for a player to confidently identify even obscure words

QUALITY CHECKLIST - Before finalizing each clue, verify:
✓ Does this clue clearly convey the word's primary meaning and usage?
✓ Would someone unfamiliar with uncommon words understand this clue?
✓ Is the clue specific enough to distinguish from similar words?
✓ Does it provide sufficient context for difficult vocabulary?
✓ Are there no letters from the target word in the clue?

Example of good clue quality for uncommon words:
- Target word: "FJORD" → Good clue: "Narrow inlet of sea between steep rocky cliffs"
- Target word: "FJORD" → Bad clue: "Water thing" (too vague)

Respond with ONLY a JSON object with a "clues" array of exactly 5 clue strings in this format:
{"clues": ["clue for word 2", "clue for word 3", "clue for word 4", "clue for word 5", "clue for word 6"]}`;

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "You are an expert word puzzle creator specializing in challenging vocabulary. Many words in extra-hard puzzles are uncommon. Your clues must be exceptionally clear and detailed to help players understand obscure word meanings. Take time to verify each word's definition and provide rich, descriptive clues.",
            },
            { role: "user", content: cluePrompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 800,
          temperature: 0.7,
        });

        const cluesResponse = response.choices?.[0]?.message?.content ?? "{}";
        let clues: string[];

        try {
          const parsed = JSON.parse(cluesResponse);
          clues = parsed.clues || Object.values(parsed);
        } catch {
          // Fallback if JSON parsing fails
          clues = [
            "Second word in sequence",
            "Third word in sequence",
            "Fourth word in sequence",
            "Fifth word in sequence",
            "Sixth word in sequence",
          ];
        }

        if (clues.length !== 5) {
          clues = [
            "Second word in sequence",
            "Third word in sequence",
            "Fourth word in sequence",
            "Fifth word in sequence",
            "Sixth word in sequence",
          ];
        }

        return {
          startWord: sequence[0],
          wordSequence: sequence,
          clues: clues,
        };
      } catch (error) {
        console.warn("Failed to generate clues with AI, using fallback clues");
        return {
          startWord: sequence[0],
          wordSequence: sequence,
          clues: [
            "Second word in sequence",
            "Third word in sequence",
            "Fourth word in sequence",
            "Fifth word in sequence",
            "Sixth word in sequence",
          ],
        };
      }
    }
  }

  throw new Error(
    `Could not find valid ${targetLength}-letter extra-hard sequence after trying 50 starting words`
  );
};

// Deterministic easy/hard puzzle generation using filtered words
const generateDeterministicRegularPuzzle = async (
  date: string,
  difficulty: "easy" | "hard",
  seedModifier: number = 0
): Promise<{ startWord: string; wordSequence: string[]; clues: string[] }> => {
  const wordsData = await loadFilteredWords();
  const words: string[] = wordsData.length_5 || [];

  if (words.length === 0) {
    throw new Error("No 5-letter words found");
  }

  // Create a seeded random generator based on date and difficulty for reproducibility
  const seedFromDate = (
    dateStr: string,
    diff: string,
    modifier: number = 0
  ): number => {
    let hash = 0;
    const combined = dateStr + diff + modifier.toString();
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash + combined.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash);
  };

  const seed = seedFromDate(date, difficulty, seedModifier);
  let randomState = seed;
  const seededRandom = () => {
    randomState = (randomState * 1664525 + 1013904223) % 4294967296;
    return randomState / 4294967296;
  };

  // For easy puzzles, prefer more common words; for hard puzzles, prefer less common ones
  const isCommonWord = (word: string): boolean => {
    const commonWords = new Set([
      "about",
      "above",
      "abuse",
      "actor",
      "acute",
      "admit",
      "adopt",
      "adult",
      "after",
      "again",
      "agent",
      "agree",
      "ahead",
      "alarm",
      "album",
      "alert",
      "alien",
      "align",
      "alike",
      "alive",
      "allow",
      "alone",
      "along",
      "alter",
      "angle",
      "angry",
      "apart",
      "apple",
      "apply",
      "arena",
      "argue",
      "arise",
      "array",
      "aside",
      "asset",
      "avoid",
      "awake",
      "award",
      "aware",
      "badly",
      "baker",
      "bases",
      "basic",
      "beach",
      "began",
      "begin",
      "being",
      "below",
      "bench",
      "billy",
      "birth",
      "black",
      "blame",
      "blank",
      "blind",
      "block",
      "blood",
      "board",
      "boost",
      "booth",
      "bound",
      "brain",
      "brand",
      "brass",
      "brave",
      "bread",
      "break",
      "breed",
      "brief",
      "bring",
      "broad",
      "broke",
      "brown",
      "build",
      "built",
      "buyer",
      "cable",
      "calif",
      "carry",
      "catch",
      "cause",
      "chain",
      "chair",
      "chaos",
      "chart",
      "chase",
      "cheap",
      "check",
      "chest",
      "chief",
      "child",
      "china",
      "chose",
      "civil",
      "claim",
      "class",
      "clean",
      "clear",
      "click",
      "climb",
      "clock",
      "close",
      "cloud",
      "coach",
      "coast",
      "could",
      "count",
      "court",
      "cover",
      "craft",
      "crash",
      "crazy",
      "cream",
      "crime",
      "cross",
      "crowd",
      "crown",
      "crude",
      "curve",
      "cycle",
      "daily",
      "dance",
      "dated",
      "dealt",
      "death",
      "debut",
      "delay",
      "depth",
      "doing",
      "doubt",
      "dozen",
      "draft",
      "drama",
      "drank",
      "dream",
      "dress",
      "drill",
      "drink",
      "drive",
      "drove",
      "dying",
      "eager",
      "early",
      "earth",
      "eight",
      "elite",
      "empty",
      "enemy",
      "enjoy",
      "enter",
      "entry",
      "equal",
      "error",
      "event",
      "every",
      "exact",
      "exist",
      "extra",
      "faith",
      "false",
      "fault",
      "fiber",
      "field",
      "fifth",
      "fifty",
      "fight",
      "final",
      "first",
      "fixed",
      "flash",
      "fleet",
      "floor",
      "fluid",
      "focus",
      "force",
      "forth",
      "forty",
      "forum",
      "found",
      "frame",
      "frank",
      "fraud",
      "fresh",
      "front",
      "fruit",
      "fully",
      "funny",
      "giant",
      "given",
      "glass",
      "globe",
      "going",
      "grace",
      "grade",
      "grand",
      "grant",
      "grass",
      "grave",
      "great",
      "green",
      "gross",
      "group",
      "grown",
      "guard",
      "guess",
      "guest",
      "guide",
      "happy",
      "harry",
      "heart",
      "heavy",
      "hence",
      "henry",
      "horse",
      "hotel",
      "house",
      "human",
      "ideal",
      "image",
      "index",
      "inner",
      "input",
      "issue",
      "japan",
      "jimmy",
      "joint",
      "jones",
      "judge",
      "known",
      "label",
      "large",
      "laser",
      "later",
      "laugh",
      "layer",
      "learn",
      "lease",
      "least",
      "leave",
      "legal",
      "level",
      "lewis",
      "light",
      "limit",
      "links",
      "lives",
      "local",
      "logic",
      "loose",
      "lower",
      "lucky",
      "lunch",
      "lying",
      "magic",
      "major",
      "maker",
      "march",
      "maria",
      "match",
      "maybe",
      "mayor",
      "meant",
      "media",
      "metal",
      "might",
      "minor",
      "minus",
      "mixed",
      "model",
      "money",
      "month",
      "moral",
      "motor",
      "mount",
      "mouse",
      "mouth",
      "moved",
      "movie",
      "music",
      "needs",
      "never",
      "newer",
      "night",
      "noise",
      "north",
      "noted",
      "novel",
      "nurse",
      "occur",
      "ocean",
      "offer",
      "often",
      "order",
      "other",
      "ought",
      "outer",
      "owned",
      "owner",
      "paint",
      "panel",
      "paper",
      "party",
      "peace",
      "peter",
      "phase",
      "phone",
      "photo",
      "piano",
      "picked",
      "piece",
      "pilot",
      "pitch",
      "place",
      "plain",
      "plane",
      "plant",
      "plate",
      "point",
      "pound",
      "power",
      "press",
      "price",
      "pride",
      "prime",
      "print",
      "prior",
      "prize",
      "proof",
      "proud",
      "prove",
      "queen",
      "quick",
      "quiet",
      "quite",
      "radio",
      "raise",
      "range",
      "rapid",
      "ratio",
      "reach",
      "ready",
      "realm",
      "rebel",
      "refer",
      "relax",
      "repay",
      "reply",
      "right",
      "rigid",
      "rival",
      "river",
      "robin",
      "roger",
      "roman",
      "rough",
      "round",
      "route",
      "royal",
      "rural",
      "scale",
      "scene",
      "scope",
      "score",
      "sense",
      "serve",
      "seven",
      "shall",
      "shape",
      "share",
      "sharp",
      "sheet",
      "shelf",
      "shell",
      "shift",
      "shine",
      "shirt",
      "shock",
      "shoot",
      "short",
      "shown",
      "sides",
      "sight",
      "silly",
      "since",
      "sixth",
      "sixty",
      "sized",
      "skill",
      "sleep",
      "slide",
      "small",
      "smart",
      "smile",
      "smith",
      "smoke",
      "snake",
      "snow",
      "solid",
      "solve",
      "sorry",
      "sound",
      "south",
      "space",
      "spare",
      "speak",
      "speed",
      "spend",
      "spent",
      "split",
      "spoke",
      "sport",
      "staff",
      "stage",
      "stake",
      "stand",
      "start",
      "state",
      "steam",
      "steel",
      "steep",
      "steer",
      "steve",
      "stick",
      "still",
      "stock",
      "stone",
      "stood",
      "store",
      "storm",
      "story",
      "strip",
      "stuck",
      "study",
      "stuff",
      "style",
      "sugar",
      "suite",
      "super",
      "sweet",
      "swift",
      "swing",
      "swiss",
      "table",
      "taken",
      "taste",
      "taxes",
      "teach",
      "terry",
      "texas",
      "thank",
      "theft",
      "their",
      "theme",
      "there",
      "these",
      "thick",
      "thing",
      "think",
      "third",
      "those",
      "three",
      "threw",
      "throw",
      "thumb",
      "tiger",
      "tight",
      "timer",
      "tiny",
      "title",
      "today",
      "token",
      "topic",
      "total",
      "touch",
      "tough",
      "tower",
      "track",
      "trade",
      "trail",
      "train",
      "treat",
      "trend",
      "trial",
      "tribe",
      "trick",
      "tried",
      "tries",
      "truck",
      "truly",
      "trunk",
      "trust",
      "truth",
      "twice",
      "twin",
      "twist",
      "tyler",
      "under",
      "undue",
      "union",
      "unity",
      "until",
      "upper",
      "upset",
      "urban",
      "usage",
      "usual",
      "valid",
      "value",
      "video",
      "virus",
      "visit",
      "vital",
      "vocal",
      "voice",
      "waste",
      "watch",
      "water",
      "wheel",
      "where",
      "which",
      "while",
      "white",
      "whole",
      "whose",
      "woman",
      "women",
      "world",
      "worry",
      "worse",
      "worst",
      "worth",
      "would",
      "write",
      "wrong",
      "wrote",
      "young",
      "yours",
      "youth",
    ]);
    return commonWords.has(word.toLowerCase());
  };

  // Filter words based on difficulty
  let targetWords: string[];
  if (difficulty === "easy") {
    // For easy puzzles, prefer common words
    const commonWords = words.filter(isCommonWord);
    targetWords = commonWords.length > 100 ? commonWords : words;
  } else {
    // For hard puzzles, prefer less common words
    const uncommonWords = words.filter((word) => !isCommonWord(word));
    targetWords = uncommonWords.length > 100 ? uncommonWords : words;
  }

  // Enhanced starting word selection for regular puzzles
  const analyzeWordConnectivity = (
    word: string,
    wordList: string[]
  ): number => {
    let connections = 0;
    for (const otherWord of wordList) {
      if (otherWord !== word && getHammingDistance(word, otherWord) === 1) {
        connections++;
      }
    }
    return connections;
  };

  const scoreStartingWord = (
    word: string,
    wordList: string[],
    isEasy: boolean
  ): number => {
    let score = 0;

    // Factor 1: Connectivity (35% weight) - how many valid next words (more important for 1-letter changes)
    const connectivity = analyzeWordConnectivity(word, wordList);
    score += connectivity * 0.35;

    // Factor 2: Difficulty appropriateness (25% weight)
    const isCommon = isCommonWord(word);
    if (isEasy && isCommon) score += 25;
    if (!isEasy && !isCommon) score += 25;

    // Factor 3: Letter diversity (20% weight) - prefer words with varied letters
    const uniqueLetters = new Set(word.split("")).size;
    score += uniqueLetters * 4; // 5 unique letters = 20 points

    // Factor 4: Vowel balance (10% weight) - prefer words with good vowel/consonant balance
    const vowels = word.match(/[aeiou]/gi)?.length || 0;
    const idealVowelRatio = 0.4; // 2 vowels in 5 letters
    const vowelRatio = vowels / word.length;
    const vowelScore = 1 - Math.abs(vowelRatio - idealVowelRatio);
    score += vowelScore * 10;

    // Factor 5: Avoid repetitive patterns (10% weight)
    const hasRepeats = /(.)\1/.test(word);
    if (!hasRepeats) score += 10;

    return score;
  };

  // Create scored word list for smarter selection
  const scoredWords = targetWords
    .map((word) => ({
      word,
      score: scoreStartingWord(word, targetWords, difficulty === "easy"),
      connectivity: analyzeWordConnectivity(word, targetWords),
    }))
    .sort((a, b) => b.score - a.score);

  // Take top candidates but add some randomization
  const topCandidates = scoredWords.slice(
    0,
    Math.min(300, Math.floor(targetWords.length * 0.4))
  );
  const shuffledWords = [...topCandidates];
  for (let i = shuffledWords.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [shuffledWords[i], shuffledWords[j]] = [shuffledWords[j], shuffledWords[i]];
  }

  // Find a valid sequence of 6 words (1 letter difference each step)
  const findValidSequence = (
    startWord: string,
    usedWords: Set<string>,
    currentSequence: string[],
    maxLength: number = 6
  ): string[] | null => {
    if (currentSequence.length === maxLength) {
      return currentSequence;
    }

    const lastWord = currentSequence[currentSequence.length - 1];

    // Find words that differ by exactly 1 letter from the last word
    for (const candidate of shuffledWords) {
      const candidateWord = candidate.word;
      if (usedWords.has(candidateWord)) continue;

      const hammingDist = getHammingDistance(lastWord, candidateWord);
      if (hammingDist === 1) {
        const newUsed = new Set(usedWords);
        newUsed.add(candidateWord);
        const newSequence = [...currentSequence, candidateWord];

        const result = findValidSequence(
          startWord,
          newUsed,
          newSequence,
          maxLength
        );
        if (result) {
          return result;
        }
      }
    }

    return null;
  };

  // Try different starting words until we find a valid sequence
  for (
    let startIndex = 0;
    startIndex < Math.min(shuffledWords.length, 100);
    startIndex++
  ) {
    const candidate = shuffledWords[startIndex];
    const startWord = candidate.word;
    const usedWords = new Set([startWord]);
    const sequence = findValidSequence(startWord, usedWords, [startWord]);

    if (startIndex === 0) {
      console.log(
        `  📊 Best ${difficulty} starting word candidate: "${startWord}" (score: ${candidate.score.toFixed(
          1
        )}, connectivity: ${candidate.connectivity})`
      );
    }

    if (sequence && sequence.length === 6) {
      console.log(
        `✅ Found valid deterministic ${difficulty} sequence: ${sequence.join(
          " → "
        )}`
      );

      // Now generate clues using OpenAI
      const openai = new OpenAI({
        apiKey: process.env.OPEN_AI_API_KEY,
      });

      const difficultyPrompt =
        difficulty === "easy"
          ? "The clues should be straightforward and accessible to most people."
          : "The clues should be more challenging and require deeper vocabulary knowledge.";

      const cluePrompt = `Generate high-quality clues for a ${difficulty} word ladder puzzle. You need to provide exactly 5 clues for the word transformations below.

Sequence: ${sequence.join(" → ")}

CRITICAL REQUIREMENTS:
1. First, verify you understand the EXACT MEANING of each target word
2. Each clue must describe the TARGET word (not the starting word)
3. Clues should be 4-12 words long and descriptively rich
4. Must NOT contain any letters from the target word itself
5. ${difficultyPrompt}
6. Each clue should give enough context for a player to confidently identify the word

QUALITY CHECKLIST - Before finalizing each clue, verify:
✓ Does this clue clearly convey the word's primary meaning?
✓ Would someone unfamiliar with the word sequence understand this clue?
✓ Is the clue specific enough to distinguish from similar words?
✓ Does it avoid being too vague or too obvious?
✓ Are there no letters from the target word in the clue?

Example of good clue quality:
- Target word: "GHOST" → Good clue: "Supernatural spirit that haunts old buildings"
- Target word: "GHOST" → Bad clue: "Spooky thing" (too vague)

Respond with ONLY a JSON object with a "clues" array of exactly 5 clue strings in this format:
{"clues": ["clue for word 2", "clue for word 3", "clue for word 4", "clue for word 5", "clue for word 6"]}`;

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "You are an expert word puzzle creator with deep vocabulary knowledge. Your clues must be precise, descriptive, and help players understand word meanings clearly. Take time to verify each word's definition before creating its clue.",
            },
            { role: "user", content: cluePrompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 800,
          temperature: 0.7,
        });

        const cluesResponse = response.choices?.[0]?.message?.content ?? "{}";
        let clues: string[];

        try {
          const parsed = JSON.parse(cluesResponse);
          clues = parsed.clues || Object.values(parsed);
        } catch {
          // Fallback if JSON parsing fails
          clues = [
            "Second word in sequence",
            "Third word in sequence",
            "Fourth word in sequence",
            "Fifth word in sequence",
            "Sixth word in sequence",
          ];
        }

        if (clues.length !== 5) {
          clues = [
            "Second word in sequence",
            "Third word in sequence",
            "Fourth word in sequence",
            "Fifth word in sequence",
            "Sixth word in sequence",
          ];
        }

        return {
          startWord: sequence[0],
          wordSequence: sequence,
          clues: clues,
        };
      } catch (error) {
        console.warn("Failed to generate clues with AI, using fallback clues");
        return {
          startWord: sequence[0],
          wordSequence: sequence,
          clues: [
            "Second word in sequence",
            "Third word in sequence",
            "Fourth word in sequence",
            "Fifth word in sequence",
            "Sixth word in sequence",
          ],
        };
      }
    }
  }

  throw new Error(
    `Could not find valid 5-letter ${difficulty} sequence after trying 100 starting words`
  );
};

// Check if a puzzle is too similar to recent puzzles in the database
const isDuplicatePuzzle = async (
  puzzleData: { startWord: string; wordSequence: string[]; clues: string[] },
  difficulty: string,
  targetDate: string
): Promise<boolean> => {
  try {
    // Calculate date range - check previous month
    const targetDateObj = new Date(targetDate);
    const startCheckDate = new Date(targetDateObj);
    startCheckDate.setMonth(startCheckDate.getMonth() - 1);
    const startCheckDateStr = startCheckDate.toISOString().split("T")[0];

    console.log(
      `  🔍 Checking for duplicates from ${startCheckDateStr} to ${targetDate}...`
    );

    // Get recent puzzles of the same difficulty
    const recentPuzzles = await prisma.dailyPuzzle.findMany({
      where: {
        difficulty,
        date: {
          gte: startCheckDateStr,
          lt: targetDate,
        },
      },
      select: {
        date: true,
        startWord: true,
        wordSequence: true,
      },
    });

    console.log(
      `  📊 Found ${recentPuzzles.length} recent ${difficulty} puzzles to check against`
    );

    // Check for exact matches
    for (const recentPuzzle of recentPuzzles) {
      const recentSequence = Array.isArray(recentPuzzle.wordSequence)
        ? (recentPuzzle.wordSequence as string[])
        : (JSON.parse(recentPuzzle.wordSequence as any) as string[]);

      // Check if start word is the same
      if (recentPuzzle.startWord === puzzleData.startWord) {
        console.log(
          `  ❌ Duplicate start word "${puzzleData.startWord}" found in puzzle from ${recentPuzzle.date}`
        );
        return true;
      }

      // Check if the word sequence is the same
      if (
        recentSequence.length === puzzleData.wordSequence.length &&
        recentSequence.every(
          (word, index) => word === puzzleData.wordSequence[index]
        )
      ) {
        console.log(
          `  ❌ Duplicate sequence found in puzzle from ${recentPuzzle.date}`
        );
        return true;
      }

      // Check if there's significant overlap (more than 50% of words are the same)
      const commonWords = recentSequence.filter((word) =>
        puzzleData.wordSequence.includes(word)
      );
      const overlapPercentage =
        commonWords.length / puzzleData.wordSequence.length;

      if (overlapPercentage >= 0.5) {
        console.log(
          `  ❌ High overlap (${Math.round(
            overlapPercentage * 100
          )}%) with puzzle from ${recentPuzzle.date}`
        );
        console.log(`    Recent: ${recentSequence.join(" → ")}`);
        console.log(`    New: ${puzzleData.wordSequence.join(" → ")}`);
        return true;
      }
    }

    console.log(`  ✅ No duplicates found - puzzle is unique`);
    return false;
  } catch (error) {
    console.warn(
      `  ⚠️  Error checking for duplicates: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    // If there's an error checking, allow the puzzle to proceed
    return false;
  }
};

const generatePuzzle = async (
  date: string,
  difficulty: string,
  isExtraHard: boolean = false,
  strategy: string = "stepwise"
) => {
  // Load extra-hard examples from DB for few-shot guidance
  let examplesText = "";
  if (isExtraHard) {
    try {
      const examples = await prisma.dailyPuzzle.findMany({
        where: { difficulty: "extra-hard" },
        orderBy: { createdAt: "desc" },
      });
      const blocks = examples.map((p) => {
        const seq = Array.isArray(p.wordSequence)
          ? (p.wordSequence as string[])
          : (JSON.parse(p.wordSequence as any) as string[]);
        return {
          length: seq?.[0]?.length ?? null,
          startWord: p.startWord,
          wordSequence: seq,
        };
      });
      examplesText = JSON.stringify(blocks);
    } catch {}
  }

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

🎯 CRITICAL VALIDATION CHECKLIST:
Before generating, verify each step:
1. All words same length (5, 6, or 7 letters)
2. Each consecutive pair differs by EXACTLY 2 or 3 letters
3. No duplicate words
4. All words are valid English words

Here are some examples of successful generations:
${examplesText}

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

    if (isExtraHard) {
      if (strategy === "deterministic") {
        // Use deterministic word-based generation for extra-hard puzzles
        try {
          const targetLength = pickLengthForAttempt(attempts - 1) === 6 ? 6 : 5;
          console.log(
            `  🎯 Attempting deterministic generation with ${targetLength}-letter words (seed modifier: ${
              attempts - 1
            })...`
          );
          puzzleData = await generateDeterministicExtraHardPuzzle(
            date,
            targetLength as 5 | 6,
            attempts - 1
          );
          console.log(`  ✅ Deterministic generation successful!`);
        } catch (error) {
          console.log(
            `  ❌ Deterministic generation failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          continue;
        }
      } else if (strategy === "holistic") {
        // Holistic extra-hard generation - generate entire sequence at once
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Generate an extra-hard word ladder puzzle for ${date}. Use a unique starting word that's different from common words. Be creative! Respond with ONLY valid JSON in the exact format specified.`,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1000,
          temperature: 0.7 + attempts * 0.1,
        });

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
              `Attempt ${attempts}: Missing JSON object in response (raw length=${raw.length}).`
            );
            throw e;
          }
        }
      } else {
        // Stepwise extra-hard generation using Responses API per-step; fallback to gpt-4o
        const lengthChoice = pickLengthForAttempt(attempts - 1); // 6,5,7 rotation

        // 1) Get a valid start word of fixed length
        const startSchema: any = {
          name: "StartWord",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { word: { type: "string" } },
            required: ["word"],
          },
          strict: true,
        };

        let startWord = "";
        try {
          console.log(
            `    🎯 Attempt ${attempts}: Generating ${lengthChoice}-letter start word with GPT-5...`
          );
          const resp: any = await (openai as any).responses.create({
            model: "gpt-5",
            input: [
              {
                role: "system",
                content: `You are a strict JSON generator. Output ONLY JSON matching the schema. Task: generate one valid English lowercase word of exact length ${lengthChoice}.\nSelf-check BEFORE responding: (1) regex ^[a-z]{${lengthChoice}}$ (2) not a proper noun (3) common dictionary word (no hyphens, no accents).`,
              },
              {
                role: "user",
                content: `Return {"word":"..."} for one ${lengthChoice}-letter valid English word.`,
              },
            ],
            response_format: { type: "json_schema", json_schema: startSchema },
            max_output_tokens: 50,
          });
          const raw = resp?.output_text ?? "";
          const data = JSON.parse(raw || "{}");
          startWord = String(data.word || "").toLowerCase();
          if (!startWord || startWord.length !== lengthChoice)
            throw new Error("bad start word");
          console.log(`    ✅ Generated start word: "${startWord}"`);
        } catch (error) {
          console.log(
            `    🔧 GPT-5 failed for start word, falling back to GPT-4o...`
          );
          // fallback to 4o
          const r = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              { role: "system", content: `Return ONLY JSON: {"word":"..."}` },
              {
                role: "user",
                content: `Give one valid English ${lengthChoice}-letter word as JSON.`,
              },
            ],
            response_format: { type: "json_object" },
            max_tokens: 30,
            temperature: 0.5,
          });
          const raw = r.choices[0].message.content ?? "{}";
          const data = JSON.parse(raw);
          startWord = String(data.word || "").toLowerCase();
          if (!startWord || startWord.length !== lengthChoice)
            throw new Error("fallback bad start word");
          console.log(`    ✅ Generated start word (fallback): "${startWord}"`);
        }

        const seq: string[] = [startWord];
        const clues: string[] = [];
        const used = new Set<string>([startWord]);

        const stepSchema: any = {
          name: "NextWord",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              word: { type: "string" },
              clue: { type: "string" },
            },
            required: ["word", "clue"],
          },
          strict: true,
        };

        let failed = false;
        for (let i = 0; i < 5; i++) {
          const prev = seq[seq.length - 1];
          let nextWord = "";
          let nextClue = "";

          let stepOk = false;
          for (let tries = 0; tries < 4 && !stepOk; tries++) {
            try {
              const resp: any = await (openai as any).responses.create({
                model: "gpt-5",
                input: [
                  {
                    role: "system",
                    content: `You are a strict JSON generator. Output ONLY JSON per schema.\nConstraints:\n- previous word: ${prev}\n- length L = ${lengthChoice}\n- Produce a DIFFERENT lowercase English word of length L (regex ^[a-z]{${lengthChoice}}$).\n- Hamming distance(prev, word) MUST be EXACTLY 2 or 3. If not, silently pick another candidate that satisfies this.\n- Do not reuse any word in this used list: ${Array.from(
                      used
                    ).join(
                      ","
                    )}.\n- The clue must be concise (6-14 words), must not include any letters of the target word, and should define/describe it without being trivial.\nSelf-check BEFORE responding: length, regex, uniqueness, Hamming distance ∈ {2,3}, clue length and character constraints.`,
                  },
                  {
                    role: "user",
                    content: `Return {"word":"...","clue":"..."}`,
                  },
                ],
                response_format: {
                  type: "json_schema",
                  json_schema: stepSchema,
                },
                max_output_tokens: 200,
              });
              const raw = resp?.output_text ?? "";
              const data = JSON.parse(raw || "{}");
              nextWord = String(data.word || "").toLowerCase();
              nextClue = String(data.clue || "");
            } catch (error) {
              console.log(
                `    🔧 Step ${i + 1}, Try ${
                  tries + 1
                }: GPT-5 failed, falling back to GPT-4o`
              );
              const r = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  {
                    role: "system",
                    content: `Return ONLY JSON {"word":"...","clue":"..."}.`,
                  },
                  {
                    role: "user",
                    content: `Previous word: ${prev}. Output a DIFFERENT valid English ${lengthChoice}-letter word with Hamming distance 2 or 3 from ${prev}, plus a concise clue. Do not reuse: ${Array.from(
                      used
                    ).join(",")}.`,
                  },
                ],
                response_format: { type: "json_object" },
                max_tokens: 200,
                temperature: 0.5,
              });
              const raw = r.choices[0].message.content ?? "{}";
              const data = JSON.parse(raw);
              nextWord = String(data.word || "").toLowerCase();
              nextClue = String(data.clue || "");
            }

            // Debug validation failures
            if (!nextWord || nextWord.length !== lengthChoice) {
              console.log(
                `    ❌ Step ${i + 1}, Try ${
                  tries + 1
                }: Invalid word "${nextWord}" (length ${
                  nextWord?.length || 0
                }, expected ${lengthChoice})`
              );
              continue;
            }
            if (used.has(nextWord)) {
              console.log(
                `    ❌ Step ${i + 1}, Try ${
                  tries + 1
                }: Duplicate word "${nextWord}" (already used)`
              );
              continue;
            }
            const d = getHammingDistance(prev, nextWord);
            if (d < 2 || d > 3) {
              console.log(
                `    ❌ Step ${i + 1}, Try ${
                  tries + 1
                }: Invalid Hamming distance "${prev}" → "${nextWord}" (distance: ${d}, expected 2-3)`
              );
              continue;
            }

            console.log(
              `    ✅ Step ${i + 1}, Try ${
                tries + 1
              }: Valid word "${prev}" → "${nextWord}" (distance: ${d})`
            );
            // accept
            stepOk = true;
          }

          if (!stepOk) {
            console.log(
              `    💥 Step ${
                i + 1
              }: Failed to generate valid word after 4 tries`
            );
            console.log(`    📊 Current sequence: [${seq.join(", ")}]`);
            console.log(`    🚫 Used words: [${Array.from(used).join(", ")}]`);
            failed = true;
            await writeFailureLog({
              date,
              difficulty,
              attempt: attempts,
              phase: "step",
              step: i + 1,
              prev,
              lengthChoice,
              used: Array.from(used),
            });
            break;
          }

          seq.push(nextWord);
          clues.push(nextClue);
          used.add(nextWord);
        }

        if (failed) {
          console.log(
            `Attempt ${attempts}: stepwise extra-hard generation failed; retrying...`
          );
          console.log(`    📋 Target length: ${lengthChoice} letters`);
          console.log(`    📝 Partial sequence: [${seq.join(", ")}]`);
          console.log(`    🔍 Generated ${seq.length - 1} out of 5 words`);
          await writeFailureLog({
            date,
            difficulty,
            attempt: attempts,
            phase: "stepwise",
            lengthChoice,
            sequenceSoFar: seq,
            cluesSoFar: clues,
          });
          continue;
        }

        puzzleData = { startWord: seq[0], wordSequence: seq, clues };
      }
    } else {
      // Use deterministic generation for easy and hard puzzles
      if (
        strategy === "deterministic" &&
        (difficulty === "easy" || difficulty === "hard")
      ) {
        try {
          console.log(
            `  🎯 Attempting deterministic generation for ${difficulty} puzzle (seed modifier: ${
              attempts - 1
            })...`
          );
          puzzleData = await generateDeterministicRegularPuzzle(
            date,
            difficulty as "easy" | "hard",
            attempts - 1
          );
          console.log(
            `  ✅ Deterministic ${difficulty} generation successful!`
          );
        } catch (error) {
          console.log(
            `  ❌ Deterministic ${difficulty} generation failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          continue;
        }
      } else {
        // Fallback to original AI-based generation
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Generate a ${difficulty} word ladder puzzle for ${date}. Use a unique starting word that's different from common words. Be creative! Respond with ONLY valid JSON in the exact format specified.`,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1000,
          temperature: 0.7 + attempts * 0.1,
        });

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
              `Attempt ${attempts}: Missing JSON object in response (raw length=${raw.length}).`
            );
            throw e;
          }
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

    // Check for duplicates against recent puzzles
    const isDuplicate = await isDuplicatePuzzle(puzzleData, difficulty, date);
    if (isDuplicate) {
      console.log(
        `Attempt ${attempts}: Puzzle is too similar to recent puzzles`
      );
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

  // Parse strategy argument
  const strategyArg = process.argv.find((arg) => arg.startsWith("--strategy="));
  const strategy = strategyArg ? strategyArg.split("=")[1] : "deterministic";

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
    console.log(`📋 Using strategy: ${strategy}`);
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
    console.log(`📋 Using strategy: ${strategy}`);
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
            difficulty.isExtraHard,
            strategy
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
