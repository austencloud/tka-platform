/**
 * TIKA Evaluation Framework Types
 *
 * Defines the data structures for:
 * - Test scenarios
 * - Evaluation results
 * - Opus review pipeline
 * - Human review flagging
 */

// ═══════════════════════════════════════════════════════════════════════════
// Supported Languages (all content must be translatable)
// ═══════════════════════════════════════════════════════════════════════════

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ja';

export interface Translatable<T> {
	en: T;
	es?: T;
	fr?: T;
	de?: T;
	pt?: T;
	ja?: T;
}

// ═══════════════════════════════════════════════════════════════════════════
// Test Scenarios
// ═══════════════════════════════════════════════════════════════════════════

export type ScenarioCategory =
	| 'letter-explanation'
	| 'term-definition'
	| 'letter-comparison'
	| 'concept-question'
	| 'misconception-correction'
	| 'practical-application'
	| 'troubleshooting'
	| 'edge-case';

export interface TikaScenario {
	/** Unique identifier */
	id: string;

	/** Human-readable name */
	name: Translatable<string>;

	/** What aspect of TIKA this tests */
	category: ScenarioCategory;

	/** User's curriculum level (1-4) */
	userLevel: 1 | 2 | 3 | 4;

	/** The question to ask TIKA */
	question: Translatable<string>;

	/** Grading criteria */
	criteria: {
		/** Terms/concepts that MUST appear in response */
		mustInclude: string[];

		/** Terms that must NOT appear (level violations) */
		mustNotInclude: string[];

		/** Tools Haiku should call */
		expectedTools: string[];

		/** Key facts that should be conveyed */
		keyFacts: Translatable<string>[];

		/** Common mistakes to check for */
		commonMistakes?: Translatable<string>[];
	};

	/** Optional: Known-correct answer for comparison */
	referenceAnswer?: Translatable<string>;

	/** Knowledge graph nodes this scenario tests */
	testsKnowledgeNodes?: string[];

	/** Difficulty estimate (for analysis) */
	difficulty: 'easy' | 'medium' | 'hard' | 'edge-case';
}

// ═══════════════════════════════════════════════════════════════════════════
// Evaluation Results
// ═══════════════════════════════════════════════════════════════════════════

export interface HaikuResponse {
	explanation: string;
	toolsCalled: Array<{
		name: string;
		input: Record<string, unknown>;
		result: unknown;
	}>;
	latencyMs: number;
	tokenUsage?: {
		input: number;
		output: number;
	};
}

export interface GradeBreakdown {
	/** 1-10: Is the TKA information correct? */
	domainAccuracy: number;

	/** 1-10: Does it avoid terms beyond user's level? */
	levelAppropriateness: number;

	/** 1-10: Did it call the right tools? */
	toolUsage: number;

	/** 1-10: Is it the right length and clarity? */
	conciseness: number;

	/** 1-10: Would a user find this helpful? */
	helpfulness: number;
}

export type ReviewRecommendation =
	| 'exemplary' // Add to example library as-is
	| 'good' // Acceptable, no action needed
	| 'needs-improvement' // Opus should rewrite
	| 'incorrect' // Domain error, needs investigation
	| 'flag-for-human'; // Opus uncertain, human must verify

export interface EvaluationResult {
	/** Links to scenario */
	scenarioId: string;

	/** Language this was evaluated in */
	language: SupportedLanguage;

	/** Timestamp of evaluation */
	evaluatedAt: Date;

	/** Raw Haiku response */
	haikuResponse: HaikuResponse;

	/** Opus's grades */
	grades: GradeBreakdown;

	/** Weighted overall score */
	overallScore: number;

	/** Opus's detailed notes */
	opusNotes: string;

	/** What should we do with this result? */
	recommendation: ReviewRecommendation;

	/** If needs-improvement, Opus's suggested rewrite */
	suggestedRewrite?: string;

	/** If incorrect, what was wrong */
	errorAnalysis?: {
		/** The specific error */
		error: string;
		/** Which knowledge graph node was violated */
		violatedNode?: string;
		/** Tools Opus used to verify this was wrong */
		verificationTools: string[];
		/** Confidence Opus has in this being wrong (0-1) */
		confidence: number;
	};

	/** If flag-for-human, why Opus is uncertain */
	uncertaintyReason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Opus Review Pipeline
// ═══════════════════════════════════════════════════════════════════════════

export interface OpusReviewContext {
	/** The original scenario */
	scenario: TikaScenario;

	/** Haiku's response to review */
	haikuResponse: HaikuResponse;

	/** Tools Opus can use to verify correctness */
	availableTools: string[];

	/** Relevant knowledge graph nodes */
	relevantKnowledge: KnowledgeNode[];
}

export interface OpusToolCall {
	tool: string;
	input: Record<string, unknown>;
	result: unknown;
	reason: string; // Why Opus called this tool
}

export interface OpusReview {
	/** The evaluation result */
	result: EvaluationResult;

	/** Tools Opus called during review */
	verificationToolCalls: OpusToolCall[];

	/** Did Opus need tools to verify? */
	requiredVerification: boolean;

	/** Time spent reviewing */
	reviewDurationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Human Review Queue
// ═══════════════════════════════════════════════════════════════════════════

export type HumanReviewStatus = 'pending' | 'in-progress' | 'resolved' | 'deferred';

export interface HumanReviewItem {
	id: string;
	createdAt: Date;
	status: HumanReviewStatus;

	/** The evaluation that triggered this */
	evaluationResult: EvaluationResult;

	/** Why this needs human review */
	reason: string;

	/** Opus's best guess (if any) */
	opusSuggestion?: string;

	/** Human's resolution */
	resolution?: {
		resolvedBy: string;
		resolvedAt: Date;
		correctAnswer: string;
		notes: string;
		/** Should this become a new knowledge graph node? */
		addToKnowledgeGraph?: KnowledgeNode;
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Semantic Knowledge Graph
// ═══════════════════════════════════════════════════════════════════════════

export type KnowledgeNodeType =
	| 'concept' // Abstract concept (e.g., "position")
	| 'term' // Specific term (e.g., "alpha")
	| 'letter' // TKA letter (e.g., "A", "Σ-")
	| 'letter-type' // Letter type (e.g., "Type 1")
	| 'motion' // Motion type (e.g., "shift")
	| 'rule' // Domain rule (e.g., "Type 1 means both hands shift")
	| 'misconception'; // Common mistake to avoid

export type RelationshipType =
	| 'is-a' // "alpha is-a position"
	| 'has-property' // "Type 1 has-property dual-shift"
	| 'requires' // "shift requires adjacent-points"
	| 'opposite-of' // "alpha opposite-of beta"
	| 'related-to' // General relationship
	| 'commonly-confused-with' // "Type 1 commonly-confused-with Type 3"
	| 'prerequisite-for' // Curriculum dependency
	| 'example-of'; // "A example-of Type 1"

export interface KnowledgeNode {
	id: string;
	type: KnowledgeNodeType;
	name: Translatable<string>;
	description: Translatable<string>;

	/** Curriculum level where this is introduced */
	introducedAtLevel: 1 | 2 | 3 | 4;

	/** Canonical facts about this node */
	facts: Translatable<string>[];

	/** Common misconceptions about this node */
	misconceptions?: Translatable<string>[];

	/** Source of truth (code path, data file, etc.) */
	sourceOfTruth?: string;
}

export interface KnowledgeRelationship {
	from: string; // Node ID
	to: string; // Node ID
	type: RelationshipType;
	description?: Translatable<string>;
	/** Is this a strict rule or a tendency? */
	strength: 'strict' | 'strong' | 'weak';
}

export interface KnowledgeGraph {
	nodes: KnowledgeNode[];
	relationships: KnowledgeRelationship[];

	/** Query helpers */
	getNode(id: string): KnowledgeNode | undefined;
	getRelated(nodeId: string, relationshipType?: RelationshipType): KnowledgeNode[];
	getPrerequisites(nodeId: string): KnowledgeNode[];
	getMisconceptions(nodeId: string): string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Evaluation Run Summary
// ═══════════════════════════════════════════════════════════════════════════

export interface EvaluationRunSummary {
	runId: string;
	startedAt: Date;
	completedAt: Date;
	language: SupportedLanguage;

	/** How many scenarios were run */
	totalScenarios: number;

	/** Results by recommendation */
	byRecommendation: Record<ReviewRecommendation, number>;

	/** Average scores by category */
	byCategoryScore: Record<ScenarioCategory, number>;

	/** Average scores by level */
	byLevelScore: Record<1 | 2 | 3 | 4, number>;

	/** Overall metrics */
	metrics: {
		averageOverallScore: number;
		averageLatencyMs: number;
		averageTokenUsage: number;
		flaggedForHumanReview: number;
		exemplaryResponses: number;
	};

	/** Identified weak areas */
	weakAreas: Array<{
		category: ScenarioCategory;
		averageScore: number;
		sampleFailures: string[]; // Scenario IDs
	}>;

	/** Knowledge graph nodes with issues */
	problematicNodes: Array<{
		nodeId: string;
		failureCount: number;
		commonError: string;
	}>;
}
