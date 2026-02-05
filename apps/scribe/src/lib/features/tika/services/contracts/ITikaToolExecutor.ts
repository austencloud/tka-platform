/**
 * ITikaToolExecutor - Contract for TKA Tool Execution
 *
 * Executes the core TKA tools for letter explanations, comparisons,
 * term definitions, position examples, and more.
 */

import type { PictographData, PictographDataWithMode } from "./ITikaPictographLoader";

// ─────────────────────────────────────────────────────────────────────────
// Inline Component Types
// ─────────────────────────────────────────────────────────────────────────

export interface InlinePictograph {
  type: "inline-pictograph";
  letter: string;
  variation?: number;
  label?: string;
}

export interface InlineGalleryItem {
  letter: string;
  variation?: number;
  label?: string;
}

export interface InlineGallery {
  type: "inline-gallery";
  items: InlineGalleryItem[];
  layout: "row" | "grid";
  gridMode?: "diamond" | "box";
  caption?: string;
  renderContext?: {
    propType: string;
    purpose: string;
  };
}

export interface InlineSequencePlayer {
  type: "inline-sequence-player";
  word: string;
  showControls: boolean;
}

export interface InlineStepGridItem {
  stepNumber: number;
  letter: string;
  label: string;
}

export interface InlineStepGrid {
  type: "inline-step-grid";
  word: string;
  steps: InlineStepGridItem[];
  caption: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Result Types
// ─────────────────────────────────────────────────────────────────────────

export interface LetterExplanationResult {
  explanation: string;
  inlinePictograph: InlinePictograph;
  contextData: {
    type: "letter";
    letter: string;
    letterType: number;
    typeName: string;
    startPosition: string;
    endPosition: string;
    blueMotion: {
      motionType: string;
      startLoc: string;
      endLoc: string;
      propRotDir: string;
    };
    redMotion: {
      motionType: string;
      startLoc: string;
      endLoc: string;
      propRotDir: string;
    };
  };
}

export interface ComparisonResult {
  explanation: string;
  inlineGallery: InlineGallery;
  contextData: {
    type: "comparison";
    letter1: string;
    letter2: string;
    letter1Data: {
      letter: string;
      type: number;
      typeName: string;
      blueMotion: string;
      redMotion: string;
    };
    letter2Data: {
      letter: string;
      type: number;
      typeName: string;
      blueMotion: string;
      redMotion: string;
    };
  };
}

export interface TypeListResult {
  explanation: string;
  inlineGallery: InlineGallery;
  contextData: {
    type: "typeList";
    typeNumber: number;
    typeName: string;
    description: string;
    exampleLetters: string[];
    allLetters: string[];
    motionPattern: {
      blueMotion: string;
      redMotion: string;
    };
    rotationPattern?: unknown;
  };
}

export interface PictographExample {
  letter: string;
  variation: number;
  startPosition: string;
  endPosition: string;
  blueMotion?: string;
  redMotion?: string;
}

export interface TermDefinitionResult {
  explanation: string;
  contextData?: {
    type: "termWithVisuals";
    term: string;
    definition: string;
    examples: PictographExample[];
  };
}

export interface PositionExamplesResult {
  explanation: string;
  vtgEquivalent?: string | null;
  inlineGalleries?: InlineGallery[];
}

export interface MotionExamplesResult {
  explanation: string;
  inlineGallery: InlineGallery;
}

export interface SequenceResult {
  explanation: string;
  inlineSequencePlayer?: InlineSequencePlayer;
}

export interface StepGridResult {
  explanation: string;
  inlineStepGrid?: InlineStepGrid;
}

// ─────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────

export interface ITikaToolExecutor {
  /**
   * Get detailed explanation of a TKA letter.
   */
  getLetterExplanation(
    letter: string,
    variation?: number
  ): LetterExplanationResult | string;

  /**
   * Get definition of a TKA term.
   */
  getTermDefinition(term: string): TermDefinitionResult | string;

  /**
   * Compare two TKA letters side by side.
   */
  compareLetters(letter1: string, letter2: string): ComparisonResult | string;

  /**
   * List all letters of a specific type with gallery.
   */
  listLettersByType(type: number): TypeListResult | string;

  /**
   * Show position examples with pictographs.
   */
  showPositionExamples(position: string): PositionExamplesResult | string;

  /**
   * Show motion type examples with pictographs.
   */
  showMotionExamples(
    motionType: string,
    hand?: "blue" | "red" | "both"
  ): MotionExamplesResult | string;

  /**
   * Generate a sequence with player component.
   */
  explainSequence(word: string): Promise<SequenceResult | string>;

  /**
   * Show sequence as step grid.
   */
  showSequenceSteps(word: string): Promise<StepGridResult | string>;

  /**
   * Get position examples by grid mode.
   */
  getPositionExamplesByMode(position: string): {
    diamond: PictographExample[];
    box: PictographExample[];
  };

  /**
   * Get motion examples.
   */
  getMotionExamples(
    motionType: string,
    hand?: "blue" | "red" | "both"
  ): PictographExample[];
}
