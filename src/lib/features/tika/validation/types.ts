/**
 * TIKA Validation Layer Types
 *
 * Types for the four-tier validation architecture that prevents LLM from
 * dumping raw technical data in responses.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Validation Result Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ValidationViolation {
	validatorName: string;
	severity: 'error' | 'warning';
	message: string;
	matchedText?: string;
	position?: number;
}

export interface ValidationResult {
	passed: boolean;
	violations: ValidationViolation[];
}

export interface ValidationContext {
	/** The user's question that prompted this response */
	userQuestion: string;
	/** Detected user level (beginner, intermediate, advanced) */
	userLevel: 'beginner' | 'intermediate' | 'advanced';
	/** Tool calls that were made during this response */
	toolsCalled: string[];
	/** Whether this is a foundational term question */
	isFoundationalQuestion: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Validator Interface
// ═══════════════════════════════════════════════════════════════════════════

export interface TikaValidator {
	/** Unique name for this validator */
	name: string;
	/** Human-readable description of what this validator checks */
	description: string;
	/** Severity of violations from this validator */
	severity: 'error' | 'warning';
	/** Run validation on the response text */
	validate(text: string, context: ValidationContext): ValidationResult;
}

// ═══════════════════════════════════════════════════════════════════════════
// Display Output Types (Tier 1 - What LLM should see)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sanitized tool output for LLM consumption.
 * contextData is stripped - LLM only sees display-ready content.
 */
export interface DisplayOutput {
	/** Human-readable explanation text */
	explanation?: string;
	/** Inline pictograph reference for client rendering */
	inlinePictograph?: {
		type: 'inline-pictograph';
		letter: string;
		variation?: number;
		label?: string;
	};
	/** Inline gallery for showing multiple pictographs */
	inlineGallery?: {
		type: 'inline-gallery';
		items: Array<{ letter: string; variation?: number; label?: string }>;
		layout: 'row' | 'grid';
		caption?: string;
	};
	/** Inline sequence player */
	inlineSequencePlayer?: {
		type: 'inline-sequence-player';
		word: string;
		showControls?: boolean;
	};
	/** Inline step grid */
	inlineStepGrid?: {
		type: 'inline-step-grid';
		word: string;
		steps: Array<{
			stepNumber: number;
			letter: string;
			variation?: number;
			label?: string;
		}>;
		caption?: string;
	};
	/** Inline quiz */
	inlineQuiz?: {
		type: 'inline-quiz';
		id: string;
		question: string;
		// ... other quiz fields
	};
	/** Simple string result (for canonical responses) */
	text?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Validation Metrics
// ═══════════════════════════════════════════════════════════════════════════

export interface ValidationMetrics {
	/** Total responses validated */
	totalResponses: number;
	/** Responses with position numbers (e.g., "alpha3") */
	responsesWithPositionNumbers: number;
	/** Responses with raw JSON */
	responsesWithRawJSON: number;
	/** Average word count for beginner questions */
	avgWordCountBeginner: number;
	/** Tool call rate for letter questions */
	toolCallRateLetterQuestions: number;
}
