/**
 * Sequence Builder for MCP Server
 *
 * Builds valid TKA sequences by chaining pictograph variations.
 * Ensures position continuity: end position of step N = start position of step N+1.
 */

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
  blueMotion: MotionData;
  redMotion: MotionData;
}

export interface SequenceStep {
  letter: string;
  variation: number;
  startPosition: string;
  endPosition: string;
  blueMotion: MotionData;
  redMotion: MotionData;
  stepNumber: number;
}

export interface SequenceResult {
  word: string;
  steps: SequenceStep[];
  startPosition: string;
  endPosition: string;
  isValid: boolean;
  error?: string;
}

/**
 * Type 6 static letters - valid for starting positions
 */
const TYPE_6_LETTERS = ["α", "β", "γ"];

/**
 * Build a valid sequence from a list of letters.
 * Uses random selection with backtracking if needed.
 */
export function buildSequenceFromLetters(
  letters: string[],
  allPictographs: PictographData[],
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

  // Try multiple times to find a valid sequence
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = attemptSequenceBuild(letters, allPictographs);
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

function attemptSequenceBuild(
  letters: string[],
  allPictographs: PictographData[]
): SequenceResult {
  const word = letters.join("");
  const steps: SequenceStep[] = [];

  // Step 1: Pick a random variation of the first letter
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

  // Find the variation index
  const firstVariationIndex = firstLetterVariations.indexOf(firstVariation);

  // Add start position step (Type 6 static letter)
  const startPosition = firstVariation.startPosition;

  // Find a valid start position (Type 6 static letter at the required position)
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
    blueMotion: startPictograph.blueMotion,
    redMotion: startPictograph.redMotion,
    stepNumber: 0,
  });

  // Add first letter as step 1
  steps.push({
    letter: firstVariation.letter,
    variation: firstVariationIndex,
    startPosition: firstVariation.startPosition,
    endPosition: firstVariation.endPosition,
    blueMotion: firstVariation.blueMotion,
    redMotion: firstVariation.redMotion,
    stepNumber: 1,
  });

  // Walk through remaining letters
  let currentEndPosition = firstVariation.endPosition;

  for (let i = 1; i < letters.length; i++) {
    const letter = letters[i];
    if (!letter) continue;

    // Find variations that start where we currently are
    const variations = allPictographs.filter(
      (p) => p.letter === letter && p.startPosition === currentEndPosition
    );

    if (variations.length === 0) {
      // No valid continuation - this attempt failed
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

    // Find variation index
    const allLetterVariations = allPictographs.filter(
      (p) => p.letter === letter
    );
    const variationIndex = allLetterVariations.indexOf(chosenVariation);

    steps.push({
      letter: chosenVariation.letter,
      variation: variationIndex >= 0 ? variationIndex : 0,
      startPosition: chosenVariation.startPosition,
      endPosition: chosenVariation.endPosition,
      blueMotion: chosenVariation.blueMotion,
      redMotion: chosenVariation.redMotion,
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

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex] ?? null;
}

/**
 * Parse a word string into individual letters.
 * Handles Greek letters (α, β, γ, etc.) and dash suffixes (W-, Σ-, etc.).
 */
export function parseWordToLetters(word: string): string[] {
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
