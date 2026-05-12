/**
 * TIKA Response Validator (Tier 3 Orchestrator)
 *
 * Runs all validators against completed responses and logs violations.
 * Violations are flagged for review but don't cause regeneration.
 */

import type {
	ValidationContext,
	ValidationViolation
} from './types';
import { ALL_VALIDATORS } from './validators';

// ═══════════════════════════════════════════════════════════════════════════
// Foundational Terms Detection
// ═══════════════════════════════════════════════════════════════════════════

const FOUNDATIONAL_TERMS = new Set([
	'alpha',
	'beta',
	'gamma',
	'shift',
	'dash',
	'static',
	'pro',
	'anti',
	'prospin',
	'antispin',
	'grid',
	'type',
	'type 1',
	'type 2',
	'type 3',
	'type 4',
	'type 5',
	'type 6',
	'pictograph',
	'sequence',
	'position',
	'motion'
]);

function isFoundationalQuestion(question: string): boolean {
	const normalized = question.toLowerCase().trim();

	// Check for "what is X" pattern with foundational term
	const whatIsPattern = /what\s+(?:is|are)\s+([a-z\s\d]+)\??/i;
	const match = normalized.match(whatIsPattern);

	if (match?.[1]) {
		const term = match[1].trim();
		return FOUNDATIONAL_TERMS.has(term);
	}

	// Check for single-word questions that are foundational terms
	const words = normalized.replace(/[?!.,]/g, '').split(/\s+/);
	if (words.length <= 3) {
		return words.some((word) => FOUNDATIONAL_TERMS.has(word));
	}

	return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// User Level Detection
// ═══════════════════════════════════════════════════════════════════════════

const BEGINNER_SIGNALS = [
	/i don'?t understand/i,
	/what does .+ mean/i,
	/what'?s the grid/i,
	/i'?m (lost|confused)/i,
	/huh\??/i,
	/wat\??/i,
	/explain .+ simply/i,
	/what is [a-z]+\??$/i // Simple "what is X?" questions
];

const ADVANCED_SIGNALS = [
	/transition from .+ to/i,
	/why can'?t I/i,
	/how does .+ relate to/i,
	/split-same|tog-same|split-opp|tog-opp/i,
	/quarter-same|quarter-opp/i,
	/vtg/i
];

function detectUserLevel(question: string): 'beginner' | 'intermediate' | 'advanced' {
	const normalized = question.toLowerCase();

	// Check for advanced signals first
	if (ADVANCED_SIGNALS.some((pattern) => pattern.test(normalized))) {
		return 'advanced';
	}

	// Check for beginner signals
	if (BEGINNER_SIGNALS.some((pattern) => pattern.test(normalized))) {
		return 'beginner';
	}

	// Default to intermediate
	return 'intermediate';
}

// ═══════════════════════════════════════════════════════════════════════════
// Response Validator
// ═══════════════════════════════════════════════════════════════════════════

export interface ValidatorOptions {
	/** Skip specific validators by name */
	skipValidators?: string[];
	/** Only run validators with this severity or higher */
	minSeverity?: 'warning' | 'error';
}

export interface ValidationReport {
	passed: boolean;
	errorCount: number;
	warningCount: number;
	violations: ValidationViolation[];
	context: ValidationContext;
	responseLength: number;
	timestamp: Date;
}

/**
 * Validate a TIKA response using all configured validators.
 */
export function validateResponse(
	responseText: string,
	userQuestion: string,
	toolsCalled: string[] = [],
	options: ValidatorOptions = {}
): ValidationReport {
	const context: ValidationContext = {
		userQuestion,
		userLevel: detectUserLevel(userQuestion),
		toolsCalled,
		isFoundationalQuestion: isFoundationalQuestion(userQuestion)
	};

	const allViolations: ValidationViolation[] = [];

	// Filter validators based on options
	let validators = ALL_VALIDATORS;

	if (options.skipValidators && options.skipValidators.length > 0) {
		validators = validators.filter((v) => !options.skipValidators!.includes(v.name));
	}

	if (options.minSeverity === 'error') {
		validators = validators.filter((v) => v.severity === 'error');
	}

	// Run each validator
	for (const validator of validators) {
		const result = validator.validate(responseText, context);
		if (!result.passed) {
			allViolations.push(...result.violations);
		}
	}

	const errorCount = allViolations.filter((v) => v.severity === 'error').length;
	const warningCount = allViolations.filter((v) => v.severity === 'warning').length;

	return {
		passed: errorCount === 0,
		errorCount,
		warningCount,
		violations: allViolations,
		context,
		responseLength: responseText.length,
		timestamp: new Date()
	};
}

/**
 * Format a validation report for logging.
 */
export function formatValidationReport(report: ValidationReport): string {
	if (report.passed && report.warningCount === 0) {
		return `[TIKA Validation] PASSED - ${report.responseLength} chars, ${report.context.userLevel} level`;
	}

	const lines = [
		`[TIKA Validation] ${report.passed ? 'PASSED WITH WARNINGS' : 'FAILED'}`,
		`  Question: "${report.context.userQuestion.slice(0, 50)}..."`,
		`  Level: ${report.context.userLevel}`,
		`  Foundational: ${report.context.isFoundationalQuestion}`,
		`  Errors: ${report.errorCount}, Warnings: ${report.warningCount}`,
		`  Violations:`
	];

	for (const v of report.violations) {
		lines.push(`    - [${v.severity.toUpperCase()}] ${v.validatorName}: ${v.message}`);
		if (v.matchedText) {
			lines.push(`      Matched: "${v.matchedText}"`);
		}
	}

	return lines.join('\n');
}

/**
 * Create a Firestore-safe violation record for logging.
 */
export function toFirestoreRecord(report: ValidationReport): Record<string, unknown> {
	return {
		passed: report.passed,
		errorCount: report.errorCount,
		warningCount: report.warningCount,
		userQuestion: report.context.userQuestion,
		userLevel: report.context.userLevel,
		isFoundationalQuestion: report.context.isFoundationalQuestion,
		toolsCalled: report.context.toolsCalled,
		responseLength: report.responseLength,
		timestamp: report.timestamp.toISOString(),
		violations: report.violations.map((v) => ({
			validator: v.validatorName,
			severity: v.severity,
			message: v.message,
			matchedText: v.matchedText || null
		}))
	};
}
