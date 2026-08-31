/**
 * TIKA Sequence Generation API
 *
 * Generates valid TKA sequences from letter arrays or word strings.
 * Returns SequenceData JSON for client-side rendering.
 */

import type { RequestHandler } from "@sveltejs/kit";
import fs from "fs";
import path from "path";
import { RATE_LIMITS } from "$lib/server/security/rate-limiter";
import { withRateLimit } from "$lib/server/security/withRateLimit";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface MotionData {
  color: string;
  startLocation: string;
  endLocation: string;
  motionType: string;
  rotationDirection: string;
}

interface PictographData {
  letter: string;
  startPosition: string;
  endPosition: string;
  timing: string;
  direction: string;
  leftMotion: MotionData;
  rightMotion: MotionData;
}

interface SequenceStep {
  letter: string;
  variation: number;
  startPosition: string;
  endPosition: string;
  leftMotion: MotionData;
  rightMotion: MotionData;
  stepNumber: number;
}

interface SequenceResult {
  word: string;
  steps: SequenceStep[];
  startPosition: string;
  endPosition: string;
  isValid: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Data Loading
// ═══════════════════════════════════════════════════════════════════════════

let allPictographs: PictographData[] = [];

function loadDataframe(): PictographData[] {
  try {
    const csvPath = path.join(
      process.cwd(),
      "static",
      "data",
      "pictographs",
      "DiamondPictographDataframe.csv"
    );
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const lines = csvContent.trim().split("\n");
    if (lines.length < 2) return [];

    const headerLine = lines[0];
    if (!headerLine) return [];
    const headers = headerLine.split(",").map((h) => h.trim());
    const pictographs: PictographData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const values = line.split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });

      pictographs.push({
        letter: row["letter"] ?? "",
        startPosition: row["startPosition"] ?? "",
        endPosition: row["endPosition"] ?? "",
        timing: row["timing"] ?? "",
        direction: row["direction"] ?? "",
        leftMotion: {
          color: "blue",
          startLocation: row["blueStartLocation"] ?? "",
          endLocation: row["blueEndLocation"] ?? "",
          motionType: row["blueMotionType"] ?? "",
          rotationDirection: row["blueRotationDirection"] ?? "",
        },
        rightMotion: {
          color: "red",
          startLocation: row["redStartLocation"] ?? "",
          endLocation: row["redEndLocation"] ?? "",
          motionType: row["redMotionType"] ?? "",
          rotationDirection: row["redRotationDirection"] ?? "",
        },
      });
    }

    return pictographs;
  } catch (error) {
    console.error("[TIKA Sequence API] Failed to load dataframe:", error);
    return [];
  }
}

function ensureDataLoaded() {
  if (allPictographs.length === 0) {
    console.log("[TIKA Sequence API] Loading pictograph dataframe...");
    allPictographs = loadDataframe();
    console.log(
      `[TIKA Sequence API] Loaded ${allPictographs.length} pictographs`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Sequence Building
// ═══════════════════════════════════════════════════════════════════════════

const TYPE_6_LETTERS = ["α", "β", "γ"];

function parseWordToLetters(word: string): string[] {
  const letters: string[] = [];
  let i = 0;

  while (i < word.length) {
    const char = word[i];
    if (!char) {
      i++;
      continue;
    }

    // Check if next char is a dash (for Type 3/5 letters)
    const nextChar = word[i + 1];
    if (nextChar === "-") {
      letters.push(char + "-");
      i += 2;
    } else {
      letters.push(char);
      i++;
    }
  }

  return letters;
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex] ?? null;
}

function buildSequenceFromLetters(
  letters: string[],
  maxAttempts: number = 100
): SequenceResult {
  if (letters.length === 0) {
    return {
      word: "",
      steps: [],
      startPosition: "",
      endPosition: "",
      isValid: false,
      error: "No letters provided",
    };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = attemptSequenceBuild(letters);
    if (result.isValid) {
      return result;
    }
  }

  return {
    word: letters.join(""),
    steps: [],
    startPosition: "",
    endPosition: "",
    isValid: false,
    error: `Failed to generate valid sequence after ${maxAttempts} attempts`,
  };
}

function attemptSequenceBuild(letters: string[]): SequenceResult {
  const word = letters.join("");
  const steps: SequenceStep[] = [];

  const firstLetter = letters[0];
  if (!firstLetter) {
    return {
      word,
      steps: [],
      startPosition: "",
      endPosition: "",
      isValid: false,
      error: "No first letter",
    };
  }

  const firstLetterVariations = allPictographs.filter(
    (p) => p.letter === firstLetter
  );

  if (firstLetterVariations.length === 0) {
    return {
      word,
      steps: [],
      startPosition: "",
      endPosition: "",
      isValid: false,
      error: `No variations found for letter "${firstLetter}"`,
    };
  }

  const firstVariation = pickRandom(firstLetterVariations);
  if (!firstVariation) {
    return {
      word,
      steps: [],
      startPosition: "",
      endPosition: "",
      isValid: false,
      error: "Failed to pick first variation",
    };
  }

  const firstVariationIndex = firstLetterVariations.indexOf(firstVariation);
  const startPosition = firstVariation.startPosition;

  // Find a valid start position (Type 6 static letter)
  const validStartPositions = allPictographs.filter((p) => {
    return (
      TYPE_6_LETTERS.includes(p.letter) &&
      p.startPosition === startPosition &&
      p.endPosition === startPosition
    );
  });

  if (validStartPositions.length === 0) {
    return {
      word,
      steps: [],
      startPosition: "",
      endPosition: "",
      isValid: false,
      error: `No Type 6 static letter found at position ${startPosition}`,
    };
  }

  const startPictograph = pickRandom(validStartPositions);
  if (!startPictograph) {
    return {
      word,
      steps: [],
      startPosition: "",
      endPosition: "",
      isValid: false,
      error: "Failed to pick start position",
    };
  }

  // Add start position as step 0
  steps.push({
    letter: startPictograph.letter,
    variation: 0,
    startPosition: startPictograph.startPosition,
    endPosition: startPictograph.endPosition,
    leftMotion: startPictograph.leftMotion,
    rightMotion: startPictograph.rightMotion,
    stepNumber: 0,
  });

  // Add first letter as step 1
  steps.push({
    letter: firstVariation.letter,
    variation: firstVariationIndex,
    startPosition: firstVariation.startPosition,
    endPosition: firstVariation.endPosition,
    leftMotion: firstVariation.leftMotion,
    rightMotion: firstVariation.rightMotion,
    stepNumber: 1,
  });

  // Walk through remaining letters
  let currentEndPosition = firstVariation.endPosition;

  for (let i = 1; i < letters.length; i++) {
    const letter = letters[i];
    if (!letter) continue;

    const variations = allPictographs.filter(
      (p) => p.letter === letter && p.startPosition === currentEndPosition
    );

    if (variations.length === 0) {
      return {
        word,
        steps: [],
        startPosition: "",
        endPosition: "",
        isValid: false,
        error: `No valid continuation for letter "${letter}" from position ${currentEndPosition}`,
      };
    }

    const chosenVariation = pickRandom(variations);
    if (!chosenVariation) {
      return {
        word,
        steps: [],
        startPosition: "",
        endPosition: "",
        isValid: false,
        error: `Failed to pick variation for letter "${letter}"`,
      };
    }

    const allLetterVariations = allPictographs.filter(
      (p) => p.letter === letter
    );
    const variationIndex = allLetterVariations.indexOf(chosenVariation);

    steps.push({
      letter: chosenVariation.letter,
      variation: variationIndex >= 0 ? variationIndex : 0,
      startPosition: chosenVariation.startPosition,
      endPosition: chosenVariation.endPosition,
      leftMotion: chosenVariation.leftMotion,
      rightMotion: chosenVariation.rightMotion,
      stepNumber: i + 1,
    });

    currentEndPosition = chosenVariation.endPosition;
  }

  return {
    word,
    steps,
    startPosition: startPosition,
    endPosition: currentEndPosition,
    isValid: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Request Handler
// ═══════════════════════════════════════════════════════════════════════════

interface SequenceRequest {
  // Either provide letters array or word string
  letters?: string[];
  word?: string;
  maxAttempts?: number;
}

export const POST: RequestHandler = async (event) => {
  const blocked = await withRateLimit(event, RATE_LIMITS.GENERAL, "ip");
  if (blocked) return blocked;

  try {
    const body: SequenceRequest = await event.request.json();

    ensureDataLoaded();

    // Parse input - accept either letters array or word string
    let letters: string[];

    if (body.letters && Array.isArray(body.letters)) {
      letters = body.letters.map((l) => l.toUpperCase());
    } else if (body.word && typeof body.word === "string") {
      letters = parseWordToLetters(body.word.toUpperCase());
    } else {
      return new Response(
        JSON.stringify({ error: "Missing letters or word in request body" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (letters.length === 0) {
      return new Response(JSON.stringify({ error: "No valid letters provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build the sequence (clamp to prevent unbounded CPU work)
    const MAX_ATTEMPTS_CEILING = 200;
    const maxAttempts = Math.min(body.maxAttempts ?? 100, MAX_ATTEMPTS_CEILING);
    const result = buildSequenceFromLetters(letters, maxAttempts);

    if (!result.isValid) {
      return new Response(
        JSON.stringify({
          error: result.error || "Failed to generate sequence",
          word: result.word,
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Return successful result
    return new Response(
      JSON.stringify({
        word: result.word,
        steps: result.steps,
        startPosition: result.startPosition,
        endPosition: result.endPosition,
        stepCount: result.steps.length - 1, // Exclude start position
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[TIKA Sequence API] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
