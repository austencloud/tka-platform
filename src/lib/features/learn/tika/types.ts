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
  type1: string;
  type2: string;
}

/**
 * Position context data
 */
export interface PositionContext {
  name: string;
  angleDegrees: string;
  description: string;
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
}

/**
 * Context data returned by the TIKA API
 */
export interface ContextData {
  type: "letter" | "term" | "comparison" | "list" | "position" | "typeList" | null;
  letter?: LetterContext;
  term?: TermContext;
  comparison?: ComparisonContext;
  position?: PositionContext;
  typeList?: TypeListContext;
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
