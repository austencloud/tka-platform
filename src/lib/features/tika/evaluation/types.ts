/**
 * TIKA Evaluation Framework Types
 *
 * Defines the data structures for:
 * - Test scenarios
 * - Evaluation results
 * - Opus review pipeline
 * - Human review flagging
 */

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ja';

export interface Translatable<T> {
	en: T;
	es?: T;
	fr?: T;
	de?: T;
	pt?: T;
	ja?: T;
}

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
	id: string;
	name: Translatable<string>;
	category: ScenarioCategory;
	userLevel: 1 | 2 | 3 | 4;
	question: Translatable<string>;
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
	scenarioId: string;
	language: SupportedLanguage;
	evaluatedAt: Date;
	haikuResponse: HaikuResponse;
	grades: GradeBreakdown;
	overallScore: number;
	opusNotes: string;
	recommendation: ReviewRecommendation;

	/** If needs-improvement, Opus's suggested rewrite */
	suggestedRewrite?: string;

	/** If incorrect, what was wrong */
	errorAnalysis?: {
		error: string;
		violatedNode?: string;
		verificationTools: string[];
		/** Confidence Opus has in this being wrong (0-1) */
		confidence: number;
	};

	/** If flag-for-human, why Opus is uncertain */
	uncertaintyReason?: string;
}

export interface OpusReviewContext {
	scenario: TikaScenario;
	haikuResponse: HaikuResponse;
	availableTools: string[];
	relevantKnowledge: KnowledgeNode[];
}

export interface OpusToolCall {
	tool: string;
	input: Record<string, unknown>;
	result: unknown;
	reason: string; // Why Opus called this tool
}

export interface OpusReview {
	result: EvaluationResult;
	verificationToolCalls: OpusToolCall[];
	requiredVerification: boolean;
	reviewDurationMs: number;
}

export type HumanReviewStatus = 'pending' | 'in-progress' | 'resolved' | 'deferred';

export interface HumanReviewItem {
	id: string;
	createdAt: Date;
	status: HumanReviewStatus;
	evaluationResult: EvaluationResult;
	reason: string;
	opusSuggestion?: string;
	resolution?: {
		resolvedBy: string;
		resolvedAt: Date;
		correctAnswer: string;
		notes: string;
		addToKnowledgeGraph?: KnowledgeNode;
	};
}

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
	introducedAtLevel: 1 | 2 | 3 | 4;
	facts: Translatable<string>[];
	misconceptions?: Translatable<string>[];
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

	getNode(id: string): KnowledgeNode | undefined;
	getRelated(nodeId: string, relationshipType?: RelationshipType): KnowledgeNode[];
	getPrerequisites(nodeId: string): KnowledgeNode[];
	getMisconceptions(nodeId: string): string[];
}

export interface EvaluationRunSummary {
	runId: string;
	startedAt: Date;
	completedAt: Date;
	language: SupportedLanguage;
	totalScenarios: number;
	byRecommendation: Record<ReviewRecommendation, number>;
	byCategoryScore: Record<ScenarioCategory, number>;
	byLevelScore: Record<1 | 2 | 3 | 4, number>;
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
