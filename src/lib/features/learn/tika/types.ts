/**
 * TIKA Module Types
 *
 * Shared type definitions for the TIKA AI assistant components.
 */

/**
 * Represents a tool call made by the LLM
 */
export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  result: unknown;
}

/**
 * Motion details for a letter's red or blue prop
 */
export interface MotionData {
  motionType: string;
  startLocation: string;
  endLocation: string;
  rotationDirection: string;
}

/**
 * Letter-specific context data
 */
export interface LetterContext {
  letter: string;
  type: number;
  typeName: string;
  startPosition: string;
  endPosition: string;
  blueMotion: MotionData;
  redMotion: MotionData;
}

/**
 * Term definition context data
 */
export interface TermContext {
  term: string;
  definition: string;
  examples: string[];
  relatedTerms: string[];
}

/**
 * Letter comparison context data
 */
export interface ComparisonContext {
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
}

/**
 * Type list context data (for showing letter type galleries)
 */
export interface TypeListContext {
  typeNumber: number;
  typeName: string;
  description: string;
  exampleLetters: string[];
  allLetters: string[];
  motionPattern: {
    blueMotion: string;
    redMotion: string;
  };
  rotationPattern?: {
    description: string;
    groups: Array<{
      letters: string;
      pattern: string;
    }>;
    note?: string;
  };
}

/**
 * Position examples context data (visual examples for a position)
 */
export interface PositionExamplesContext {
  position: string;
  definition: string;
  examples: Array<{
    letter: string;
    variation: number;
    startPosition: string;
    endPosition: string;
  }>;
}

/**
 * Motion examples context data (visual examples for a motion type)
 */
export interface MotionExamplesContext {
  motionType: string;
  definition: string;
  examples: Array<{
    letter: string;
    variation: number;
    blueMotion: string;
    redMotion: string;
  }>;
}

/**
 * Term with visual examples context data
 */
export interface TermWithVisualsContext {
  term: string;
  definition: string;
  examples: Array<{
    letter: string;
    variation: number;
  }>;
}

/**
 * Context data returned by the TIKA API
 */
export interface ContextData {
  type:
    | "letter"
    | "term"
    | "comparison"
    | "list"
    | "typeList"
    | "positionExamples"
    | "motionExamples"
    | "termWithVisuals"
    | null;
  letter?: LetterContext;
  term?: TermContext;
  comparison?: ComparisonContext;
  typeList?: TypeListContext;
  positionExamples?: PositionExamplesContext;
  motionExamples?: MotionExamplesContext;
  termWithVisuals?: TermWithVisualsContext;
}

/**
 * A single conversation item (question + response)
 */
export interface ConversationItem {
  question: string;
  response: {
    explanation: string;
    showPictograph: boolean;
    pictographLetter?: string;
    pictographVariation?: number;
    latencyMs: number;
    toolsCalled: ToolCall[];
    contextData?: ContextData;
  };
  timestamp: Date;
}
