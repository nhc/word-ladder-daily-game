import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Cache for word validation to reduce API calls
const wordCache = new Map<string, boolean>();
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const cacheTimestamps = new Map<string, number>();

// Check if word exists using Free Dictionary API
const checkWordExists = async (word: string): Promise<boolean> => {
  const normalizedWord = word.toLowerCase().trim();

  // Check cache first
  const cached = wordCache.get(normalizedWord);
  const timestamp = cacheTimestamps.get(normalizedWord);

  if (
    cached !== undefined &&
    timestamp &&
    Date.now() - timestamp < CACHE_EXPIRY
  ) {
    return cached;
  }

  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        normalizedWord
      )}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );

    const isValid = response.ok; // 200 = word exists, 404 = word doesn't exist

    // Cache the result
    wordCache.set(normalizedWord, isValid);
    cacheTimestamps.set(normalizedWord, Date.now());

    return isValid;
  } catch (error) {
    // If API fails, assume word is valid to avoid blocking gameplay
    // In production, you might want to log this for monitoring
    return true;
  }
};

export async function POST(request: NextRequest) {
  try {
    const { word, expectedWord } = await request.json();

    if (!word || !expectedWord) {
      return NextResponse.json(
        { error: "Word and expected word are required" },
        { status: 400 }
      );
    }

    // Convert to lowercase
    const normalizedWord = word.toLowerCase().trim();
    const normalizedExpected = expectedWord.toLowerCase().trim();

    // Check if it matches the expected word
    const isCorrect = normalizedWord === normalizedExpected;

    // Check if it's a valid English word using dictionary API
    const isValidWord = await checkWordExists(normalizedWord);

    return NextResponse.json({
      isCorrect,
      isValidWord,
      word: normalizedWord,
    });
  } catch (error) {
    console.error("Error validating word:", error);
    return NextResponse.json(
      { error: "Failed to validate word" },
      { status: 500 }
    );
  }
}
