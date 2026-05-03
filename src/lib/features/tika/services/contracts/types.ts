/**
 * Co-exported types from retired interface contracts.
 */

import type { AppCapability } from "../../knowledge/app-capabilities-manifest";
import type {
  InlinePictograph,
  InlineGallery,
  InlineSequencePlayer,
  InlineStepGrid,
  InlineQuiz,
} from "../../types";
// Re-export so consumers can import from contracts/types
export type { InlineQuiz, InlineStepGrid };

// === From ITikaMessageExtractor ===

export interface ToolInfo {
	name: string;
	args: Record<string, unknown>;
	isPending: boolean;
}
export interface InlineContent {
	pictograph?: InlinePictograph;
	gallery?: InlineGallery;
	galleries?: InlineGallery[];
	sequencePlayer?: InlineSequencePlayer;
	stepGrid?: InlineStepGrid;
	quiz?: InlineQuiz;
}

// === From ITikaMarkdownParser ===

export interface ParsedMarkdown {
	/** The HTML-rendered content */
	html: string;
	/** Extracted links for footnote-style display */
	links: Array<{ text: string; url: string }>;
}

// === From ITikaQuizGenerator ===

export type QuizDisplayMode = "text" | "pictograph-grid" | "motion-chips";
export type QuizType =
  | "pick-letter"
  | "pick-type"
  | "odd-one-out"
  | "match-motion"
  | "true-false";
export type QuizDifficulty = "easy" | "medium" | "hard";
export interface TextOption {
  id: string;
  type: "text";
  text: string;
  correct: boolean;
}
export interface PictographOption {
  id: string;
  type: "pictograph";
  letter: string;
  variation?: number;
  correct: boolean;
}
export interface MotionPatternOption {
  id: string;
  type: "motion-pattern";
  blueMotion: string;
  redMotion: string;
  correct: boolean;
}
export type QuizOption = TextOption | PictographOption | MotionPatternOption;
export interface QuizResult {
  explanation: string;
  inlineQuiz: InlineQuiz;
}

// === From ITikaSequenceGenerator ===

export interface SequenceStepMotion {
  motionType: string;
  startLocation: string;
  endLocation: string;
  rotationDirection: string;
}
export interface SequenceStep {
  letter: string;
  variation: number;
  startPosition: string;
  endPosition: string;
  stepNumber: number;
  blueMotion: SequenceStepMotion;
  redMotion: SequenceStepMotion;
}
export interface GeneratedSequenceResult {
  word: string;
  steps: SequenceStep[];
  startPosition: string;
  endPosition: string;
  isValid: boolean;
  error?: string;
}

// === From ITikaToolExecutor ===

export interface InlineGalleryItem {
  letter: string;
  variation?: number;
  label?: string;
}
export interface InlineStepGridItem {
  stepNumber: number;
  letter: string;
  label: string;
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
export interface ToolExecutorSequenceResult {
  explanation: string;
  inlineSequencePlayer?: InlineSequencePlayer;
}
export interface StepGridResult {
  explanation: string;
  inlineStepGrid?: InlineStepGrid;
}

// === From ITikaProgressWriter ===

export interface VerificationResult {
  success: boolean;
  completedConcepts: string[];
  rejectedConcepts: Array<{ id: string; reason: string }>;
  errors: string[];
  newMajorLevel?: number;
}

// === From ITikaInteractionTracker ===

export interface TikaTopicInteraction {
  /** Normalized topic identifier (e.g., "letter-A", "position-alpha", "type-1") */
  topic: string;
  /** How many times this topic has been discussed */
  interactionCount: number;
  /** When this topic was last discussed */
  lastDiscussed: Date;
  /** Number of quiz attempts on this topic via TIKA inline quizzes */
  quizAttempts: number;
  /** Ratio of correct answers (0-1), or 0 if no attempts */
  quizCorrectRate: number;
}

// === From ITikaModelProvider ===

export interface ModelConfig {
  provider: "anthropic" | "deepseek";
  modelId: string;
}

// === From ITikaPictographCache ===

export interface TikaPictographCacheStats {
  memoryCount: number;
  persistedCount: number;
  sizeBytes: number;
}

// === From ITikaPictographLoader ===

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

// === From ITikaSequenceValidator ===

export interface SequenceTransition {
  from: string;
  to: string;
  fromEndGroup: string;
  toStartGroup: string;
  isValid: boolean;
  bridgeOptions?: string[];
}
export interface InvalidTransition {
  position: number;
  from: string;
  to: string;
  reason: string;
  suggestedBridges: string[];
}
export interface SequenceValidationResult {
  isValid: boolean;
  word: string;
  letters: string[];
  transitions: SequenceTransition[];
  invalidTransitions: InvalidTransition[];
  interpolatedSequence?: string;
  explanation: string;
}

// === From ITikaWelcomeBuilder ===

export interface WelcomeSuggestion {
  icon: string;
  text: string;
  question: string;
  reason: "review" | "next" | "continue" | "explore";
}
export interface WelcomeContext {
  greeting: string;
  suggestions: WelcomeSuggestion[];
  hasHistory: boolean;
}

// === From IConversationMemoryRetriever ===

export interface ConversationMemorySummary {
  sessionId: string;
  title: string;
  lastUserMessage: string;
  updatedAt: Date;
  messageCount: number;
}

// === From ITikaCapabilityLookup ===

export interface CapabilityMatch {
  capability: AppCapability;
  relevance: number; // 0-1
}
