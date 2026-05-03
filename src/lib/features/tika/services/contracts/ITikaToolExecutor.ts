/**
 * ITikaToolExecutor - Contract for TKA Tool Execution
 *
 * Executes the core TKA tools for letter explanations, comparisons,
 * term definitions, position examples, and more.
 */

export interface InlinePictograph {
  type: "inline-pictograph";
  letter: string;
  variation?: number;
  label?: string;
  gridMode?: "diamond" | "box";
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

export interface ITikaToolExecutor {
  getLetterExplanation(
    letter: string,
    variation?: number,
    gridMode?: "diamond" | "box"
  ): LetterExplanationResult | string;

  getTermDefinition(term: string): TermDefinitionResult | string;

  compareLetters(letter1: string, letter2: string): ComparisonResult | string;

  listLettersByType(type: number): TypeListResult | string;

  showPositionExamples(position: string): PositionExamplesResult | string;

  showMotionExamples(
    motionType: string,
    hand?: "blue" | "red" | "both"
  ): MotionExamplesResult | string;

  explainSequence(word: string): Promise<SequenceResult | string>;

  showSequenceSteps(word: string): Promise<StepGridResult | string>;

  getPositionExamplesByMode(position: string): {
    diamond: PictographExample[];
    box: PictographExample[];
  };

  getMotionExamples(
    motionType: string,
    hand?: "blue" | "red" | "both"
  ): PictographExample[];
}
