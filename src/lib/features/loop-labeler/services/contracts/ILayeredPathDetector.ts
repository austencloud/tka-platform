/**
 * Layered Path LOOP Detection Service Contract
 *
 * Detects LOOPs constructed from independent hand paths layered together.
 * This is the "traditional" or "classic" way LOOPs were originally designed.
 *
 * Subtypes:
 * - Isorhythmic: Both hands have the same cycle length (e.g., 4:4)
 * - Polyrhythmic: Hands have different cycle lengths (e.g., 3:4)
 */

/**
 * Represents a single hand's repeating path cycle
 */
export interface HandPathCycle {
  /** Which hand this cycle describes */
  hand: "blue" | "red";

  /** Number of steps in one complete cycle */
  cycleLength: number;

  /** How many times the cycle repeats in the full sequence */
  repeatCount: number;

  /** Path sequence as location transitions, e.g., ["s→n", "n→e", "e→w", "w→s"] */
  pathSequence: string[];

  /** Motion type pattern, e.g., ["dash", "anti", "dash", "anti"] */
  motionPattern: string[];

  /** Rotation direction pattern, e.g., ["noRotation", "ccw", "noRotation", "cw"] */
  rotationPattern: string[];

  /** Whether the path forms a complete loop (returns to start) */
  isClosedLoop: boolean;

  /** Confidence score for this cycle detection (0-1) */
  confidence: number;
}

/**
 * Positional category for zone coverage analysis
 */
export type PositionalCategory = "alpha" | "beta" | "gamma1" | "gamma2";

/**
 * Zone coverage analysis - tracks which positional categories are visited
 */
export interface ZoneCoverageAnalysis {
  /** Coverage per sequence half */
  perHalf: {
    first: Record<PositionalCategory, number>;
    second: Record<PositionalCategory, number>;
  };

  /** True if each half visits all 4 positional categories */
  hasCompleteCoverage: boolean;

  /** True if coverage follows a "Latin Square" pattern */
  hasLatinSquarePattern: boolean;

  /** Human-readable summary */
  summary: string;
}

/**
 * Result of Layered Path detection
 */
export interface LayeredPathResult {
  /** Whether a layered path pattern was detected */
  isLayeredPath: boolean;

  /** Blue hand's detected cycle */
  blueCycle: HandPathCycle | null;

  /** Red hand's detected cycle */
  redCycle: HandPathCycle | null;

  /** Rhythm type classification */
  rhythmType: "isorhythmic" | "polyrhythmic" | null;

  /** For polyrhythmic: the ratio of cycle lengths (e.g., "3:4") */
  polyrhythmRatio: string | null;

  /** Zone coverage analysis (observation for research) */
  zoneCoverage: ZoneCoverageAnalysis | null;

  /** Human-readable description */
  description: string;

  /** Overall confidence score (0-1) */
  confidence: number;
}

/**
 * Service for detecting Layered Path LOOP patterns
 */
export interface ILayeredPathDetector {
  /**
   * Detect layered path patterns in a sequence
   * @param rawSequence The raw sequence data array (including metadata at index 0)
   * @returns Analysis result with detected layered path information
   */
  detectLayeredPath(rawSequence: Record<string, unknown>[]): LayeredPathResult;

  /**
   * Analyze a single hand's path for periodicity
   * @param rawSequence The raw sequence data
   * @param hand Which hand to analyze
   * @returns Detected cycle or null if no clear periodicity
   */
  analyzeHandPath(
    rawSequence: Record<string, unknown>[],
    hand: "blue" | "red"
  ): HandPathCycle | null;

  /**
   * Analyze positional zone coverage
   * @param rawSequence The raw sequence data
   * @returns Zone coverage analysis
   */
  analyzeZoneCoverage(
    rawSequence: Record<string, unknown>[]
  ): ZoneCoverageAnalysis;
}
