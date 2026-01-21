/**
 * ITikaPictographLoader - Contract for TKA Pictograph Data Loading
 *
 * Handles loading and caching of pictograph data from CSV files,
 * glossary definitions, and letter type information.
 */

export interface MotionData {
  color: string;
  startLocation: string;
  endLocation: string;
  motionType: string;
  rotationDirection: string;
}

export interface PictographData {
  letter: string;
  startPosition: string;
  endPosition: string;
  timing: string;
  direction: string;
  blueMotion: MotionData;
  redMotion: MotionData;
}

export interface PictographDataWithMode extends PictographData {
  gridMode: "diamond" | "box";
}

export interface GlossaryEntry {
  definition: string;
  examples: string[];
  relatedTerms: string[];
  category: string;
}

export interface LetterTypeInfo {
  name: string;
  description: string;
  characteristics: string[];
  letters: string[];
  motionPattern: {
    blueMotion: string;
    redMotion: string;
    note?: string;
  };
}

export interface LetterPositionMapping {
  startPosition: string;
  endPosition: string;
  startGroup: string;
  endGroup: string;
}

export interface ITikaPictographLoader {
  /**
   * Ensures all data is loaded and cached.
   * Safe to call multiple times - will only load once.
   */
  ensureLoaded(): void;

  /**
   * Get all pictographs (combined diamond + box modes)
   */
  getAllPictographs(): PictographData[];

  /**
   * Get diamond mode pictographs only
   */
  getDiamondPictographs(): PictographDataWithMode[];

  /**
   * Get box mode pictographs only
   */
  getBoxPictographs(): PictographDataWithMode[];

  /**
   * Get the glossary of TKA terms
   */
  getGlossary(): Record<string, GlossaryEntry>;

  /**
   * Get letter type definitions
   */
  getLetterTypes(): Record<string, LetterTypeInfo>;

  /**
   * Get letter position mappings for sequence validation
   */
  getLetterPositionMappings(): Record<string, LetterPositionMapping>;

  /**
   * Get bridge letters by transition (for fixing invalid sequences)
   */
  getBridgeLettersByTransition(): Record<string, string[]>;

  /**
   * Get variations for a specific letter
   */
  getLetterVariations(letter: string): PictographData[];

  /**
   * Get variations for a specific letter in a specific grid mode
   */
  getLetterVariationsByMode(
    letter: string,
    gridMode: "diamond" | "box"
  ): PictographDataWithMode[];
}
