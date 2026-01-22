/**
 * Sequence Builder for MCP Server
 *
 * Builds valid TKA sequences by chaining pictograph variations.
 * Ensures position continuity: end position of step N = start position of step N+1.
 *
 * Key changes for parity with main app:
 * 1. Filter by position only (not orientation) during selection
 * 2. Use bridge letters when direct transitions aren't possible
 * 3. Recalculate orientations after the full sequence is built
 */

import { getLetterTransitionGraph } from "./letter-transition-graph.js";
import { recalculateAllOrientations } from "./orientation-propagation.js";

interface MotionData {
  color: string;
  startLocation: string;
  endLocation: string;
  motionType: string;
  rotationDirection: string;
  startOrientation: string;  // "in" | "out" | "clock" | "counter"
  endOrientation: string;    // "in" | "out" | "clock" | "counter"
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
  /** Whether this step is a bridge letter (interpolated, not user-requested) */
  isBridge?: boolean;
}

export interface SequenceResult {
  word: string;
  steps: SequenceStep[];
  startPosition: string;
  endPosition: string;
  isValid: boolean;
  error?: string;
  /** Information about bridge letters used in the sequence */
  bridges?: BridgeInfo[];
}

/**
 * Type 6 static letters - valid for starting positions
 */
const TYPE_6_LETTERS = ["α", "β", "γ"];

/**
 * Bridge selection options for sequence building.
 * Maps transition index (0-based) to preferred bridge index.
 * Example: { 0: 2 } means "for the first transition needing a bridge, use the 3rd option"
 */
export interface BridgeSelections {
  [transitionIndex: number]: number;
}

/**
 * Information about bridges used in a sequence.
 */
export interface BridgeInfo {
  /** Index of the transition (which gap between letters) */
  transitionIndex: number;
  /** The letter before the bridge */
  fromLetter: string;
  /** The letter after the bridge */
  toLetter: string;
  /** All available bridge options for this transition */
  availableOptions: string[];
  /** The bridge letter that was selected */
  selectedBridge: string;
  /** Index of the selected bridge in availableOptions */
  selectedIndex: number;
}

/**
 * Expand letters with bridge letters where direct transitions aren't possible.
 * Uses BFS via LetterTransitionGraph to find shortest bridge paths.
 *
 * @param letters - The letters to expand
 * @param bridgeSelections - Optional map of transition index to preferred bridge index
 * @returns Object with expanded letters and bridge info
 */
function expandLettersWithBridges(
  letters: string[],
  bridgeSelections?: BridgeSelections
): { expanded: string[]; bridges: BridgeInfo[]; bridgeIndices: Set<number> } {
  if (letters.length <= 1) {
    return { expanded: letters, bridges: [], bridgeIndices: new Set() };
  }

  const transitionGraph = getLetterTransitionGraph();
  const expanded: string[] = [];
  const bridges: BridgeInfo[] = [];
  const bridgeIndices = new Set<number>();
  let bridgeTransitionIndex = 0;

  for (let i = 0; i < letters.length; i++) {
    const currentLetter = letters[i];
    if (!currentLetter) continue;

    if (i === 0) {
      expanded.push(currentLetter);
      continue;
    }

    const previousLetter = expanded[expanded.length - 1];
    if (!previousLetter) {
      expanded.push(currentLetter);
      continue;
    }

    // Check if we need bridge letters
    const availableOptions = transitionGraph.findAllBridgeOptions(previousLetter, currentLetter);

    if (availableOptions.length > 0) {
      // We need a bridge - select based on bridgeSelections or default to first
      const preferredIndex = bridgeSelections?.[bridgeTransitionIndex] ?? 0;
      const selectedIndex = Math.min(preferredIndex, availableOptions.length - 1);
      const selectedBridge = availableOptions[selectedIndex];

      if (selectedBridge) {
        // Track this index as a bridge letter
        bridgeIndices.add(expanded.length);
        expanded.push(selectedBridge);

        bridges.push({
          transitionIndex: bridgeTransitionIndex,
          fromLetter: previousLetter,
          toLetter: currentLetter,
          availableOptions,
          selectedBridge,
          selectedIndex,
        });
      }

      bridgeTransitionIndex++;
    } else if (!transitionGraph.canFollow(previousLetter, currentLetter)) {
      // No single-letter bridge available, fall back to BFS path
      const bfsPath = transitionGraph.findBridgeLetters(previousLetter, currentLetter);
      for (const bridge of bfsPath) {
        // Track all BFS path letters as bridges
        bridgeIndices.add(expanded.length);
        expanded.push(bridge);
      }
      // Note: multi-letter bridges don't support selection (rare case)
    }

    // Add the target letter
    expanded.push(currentLetter);
  }

  return { expanded, bridges, bridgeIndices };
}

/**
 * Build a valid sequence from a list of letters.
 * Uses random selection with backtracking if needed.
 * Automatically inserts bridge letters and recalculates orientations.
 *
 * @param letters - Array of letters to build sequence from
 * @param allPictographs - All available pictograph data
 * @param maxAttempts - Maximum attempts to find valid sequence
 * @param bridgeSelections - Optional map of transition index to preferred bridge index
 */
export function buildSequenceFromLetters(
  letters: string[],
  allPictographs: PictographData[],
  maxAttempts: number = 100,
  bridgeSelections?: BridgeSelections
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

  // Expand letters with bridges for position continuity
  const { expanded: expandedLetters, bridges, bridgeIndices } = expandLettersWithBridges(letters, bridgeSelections);

  // Try multiple times to find a valid sequence
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = attemptSequenceBuild(expandedLetters, allPictographs, letters.join(""), bridgeIndices);
    if (result.isValid) {
      // CRITICAL: Recalculate orientations after successful build
      const finalResult = recalculateAllOrientations(result);
      finalResult.bridges = bridges;
      return finalResult;
    }
  }

  return {
    word: letters.join(""),
    steps: [],
    startPosition: "",
    endPosition: "",
    isValid: false,
    error: `Failed to generate valid sequence after ${maxAttempts} attempts`,
    bridges,
  };
}

function attemptSequenceBuild(
  letters: string[],
  allPictographs: PictographData[],
  originalWord?: string,
  bridgeIndices?: Set<number>
): SequenceResult {
  const word = originalWord || letters.join("");
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
  // Filter by position only - orientations will be recalculated after sequence build
  const validStartPositions = allPictographs.filter((p) => {
    // Must be a Type 6 static letter at the same position
    return TYPE_6_LETTERS.includes(p.letter) &&
           p.startPosition === startPosition &&
           p.endPosition === startPosition;
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

  // Add first letter as step 1 (first letter is never a bridge)
  steps.push({
    letter: firstVariation.letter,
    variation: firstVariationIndex,
    startPosition: firstVariation.startPosition,
    endPosition: firstVariation.endPosition,
    blueMotion: firstVariation.blueMotion,
    redMotion: firstVariation.redMotion,
    stepNumber: 1,
    isBridge: false,
  });

  // Walk through remaining letters
  // Track position only - orientations will be recalculated after sequence build
  let currentEndPosition = firstVariation.endPosition;

  for (let i = 1; i < letters.length; i++) {
    const letter = letters[i];
    if (!letter) continue;

    // Find variations that start where we currently are (position only)
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
      isBridge: bridgeIndices?.has(i) ?? false,
    });

    // Update current position for next iteration
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
