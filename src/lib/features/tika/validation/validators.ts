/**
 * TIKA Response Validators (Tier 3)
 *
 * Regex-based validators that run after the LLM response completes.
 * These catch violations that slip through tool output filtering.
 */

import type { TikaValidator, ValidationResult, ValidationContext, ValidationViolation } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function createViolation(
	validatorName: string,
	severity: 'error' | 'warning',
	message: string,
	matchedText?: string,
	position?: number
): ValidationViolation {
	return { validatorName, severity, message, matchedText, position };
}

function pass(): ValidationResult {
	return { passed: true, violations: [] };
}

function fail(violations: ValidationViolation[]): ValidationResult {
	return { passed: false, violations };
}

// ═══════════════════════════════════════════════════════════════════════════
// Position Number Validator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Catches position numbers like "alpha3", "beta5", "gamma11"
 * These are internal data - users should see "alpha" not "alpha3"
 */
export const noPositionNumbers: TikaValidator = {
	name: 'NoPositionNumbers',
	description: 'Catches internal position numbers (alpha3, beta5) that should not appear in responses',
	severity: 'error',

	validate(text: string, _context: ValidationContext): ValidationResult {
		const pattern = /(alpha|beta|gamma|zeta|eta)\d+/gi;
		const matches = [...text.matchAll(pattern)];

		if (matches.length === 0) {
			return pass();
		}

		const violations = matches.map((match) =>
			createViolation(
				this.name,
				this.severity,
				`Position number "${match[0]}" exposed to user. Use plain position name instead.`,
				match[0],
				match.index
			)
		);

		return fail(violations);
	}
};

// ═══════════════════════════════════════════════════════════════════════════
// Degree Measurements Validator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Catches degree measurements like "90 degrees", "180°"
 * Users should hear "adjacent point" or "opposite point", not angles
 */
export const noDegrees: TikaValidator = {
	name: 'NoDegrees',
	description: 'Catches degree measurements that should use grid-based descriptions instead',
	severity: 'warning',

	validate(text: string, _context: ValidationContext): ValidationResult {
		// Match patterns like "90 degrees", "180°", "90°"
		const pattern = /\b\d+\s*°?\s*degrees?\b|\b\d+°/gi;
		const matches = [...text.matchAll(pattern)];

		if (matches.length === 0) {
			return pass();
		}

		const violations = matches.map((match) =>
			createViolation(
				this.name,
				this.severity,
				`Degree measurement "${match[0]}" found. Use "adjacent point" or "opposite point" instead.`,
				match[0],
				match.index
			)
		);

		return fail(violations);
	}
};

// ═══════════════════════════════════════════════════════════════════════════
// Raw JSON Validator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Catches raw JSON object dumps in responses
 */
export const noRawJSON: TikaValidator = {
	name: 'NoRawJSON',
	description: 'Catches raw JSON object structures dumped in responses',
	severity: 'error',

	validate(text: string, _context: ValidationContext): ValidationResult {
		// Match JSON-like patterns: { "key": or { key:
		const pattern = /\{[\s\S]{0,50}"[a-zA-Z_]+"\s*:/g;
		const matches = [...text.matchAll(pattern)];

		if (matches.length === 0) {
			return pass();
		}

		const violations = matches.map((match) =>
			createViolation(
				this.name,
				this.severity,
				'Raw JSON structure found in response. Tool output should be summarized, not dumped.',
				match[0].slice(0, 50) + '...',
				match.index
			)
		);

		return fail(violations);
	}
};

// ═══════════════════════════════════════════════════════════════════════════
// Context Data Validator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Catches internal contextData fields that should never appear
 */
export const noContextData: TikaValidator = {
	name: 'NoContextData',
	description: 'Catches internal contextData fields that should be stripped before LLM sees them',
	severity: 'error',

	validate(text: string, _context: ValidationContext): ValidationResult {
		// Match specific internal field patterns
		const patterns = [
			/"contextData"/gi,
			/"startPosition"\s*:/gi,
			/"endPosition"\s*:/gi,
			/"blueMotion"\s*:\s*\{/gi,
			/"redMotion"\s*:\s*\{/gi,
			/"motionType"\s*:/gi,
			/"rotationDirection"\s*:/gi,
			/"startLocation"\s*:/gi,
			/"endLocation"\s*:/gi,
			/"letterType"\s*:\s*\d/gi,
			/variation\s*:\s*\d+/gi
		];

		const violations: ValidationViolation[] = [];

		for (const pattern of patterns) {
			const matches = [...text.matchAll(pattern)];
			for (const match of matches) {
				violations.push(
					createViolation(
						this.name,
						this.severity,
						`Internal data field "${match[0]}" found in response.`,
						match[0],
						match.index
					)
				);
			}
		}

		if (violations.length === 0) {
			return pass();
		}

		return fail(violations);
	}
};

// ═══════════════════════════════════════════════════════════════════════════
// Brevity Check Validator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ensures beginner responses are brief
 * Foundational questions should get ~15 words, not paragraphs
 */
export const brevityCheck: TikaValidator = {
	name: 'BrevityCheck',
	description: 'Ensures beginner responses stay concise (under 50 words for foundational questions)',
	severity: 'warning',

	validate(text: string, context: ValidationContext): ValidationResult {
		// Only apply to beginner + foundational questions
		if (context.userLevel !== 'beginner' || !context.isFoundationalQuestion) {
			return pass();
		}

		// Count words (rough approximation)
		const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
		const maxWords = 50;

		if (wordCount <= maxWords) {
			return pass();
		}

		return fail([
			createViolation(
				this.name,
				this.severity,
				`Response has ${wordCount} words but beginner foundational questions should be under ${maxWords} words.`,
				undefined,
				undefined
			)
		]);
	}
};

// ═══════════════════════════════════════════════════════════════════════════
// Type 1 Misconception Validator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Catches the common misconception that Type 1 is special because "both hands move"
 * Multiple types have both hands moving - Type 1's distinction is that both SHIFT
 */
export const noType1Misconception: TikaValidator = {
	name: 'NoType1Misconception',
	description: 'Catches incorrect claims that Type 1 is unique because "both hands move"',
	severity: 'error',

	validate(text: string, _context: ValidationContext): ValidationResult {
		// Match patterns like "type 1... both hands move" as the distinguishing feature
		const patterns = [
			/type\s*1[^.]*both\s+hands\s+mov/gi,
			/dual[-\s]?shift[^.]*both\s+hands\s+mov(?!e\s+to\s+adjacent)/gi,
			/type\s*1[^.]*where\s+both\s+hands\s+move/gi
		];

		const violations: ValidationViolation[] = [];

		for (const pattern of patterns) {
			const matches = [...text.matchAll(pattern)];
			for (const match of matches) {
				// Check if this is the "both hands move TO ADJACENT" correction (which is fine)
				if (/move\s+to\s+adjacent/i.test(match[0])) {
					continue;
				}
				violations.push(
					createViolation(
						this.name,
						this.severity,
						'Incorrect: Type 1 is not unique because "both hands move". Types 3 and 5 also have both hands moving. Type 1\'s distinction is that both hands SHIFT.',
						match[0],
						match.index
					)
				);
			}
		}

		if (violations.length === 0) {
			return pass();
		}

		return fail(violations);
	}
};

// ═══════════════════════════════════════════════════════════════════════════
// Variation Number Validator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Catches "X variations" counts that are internal data
 */
export const noVariationCounts: TikaValidator = {
	name: 'NoVariationCounts',
	description: 'Catches variation counts like "8 variations" which are internal data',
	severity: 'warning',

	validate(text: string, _context: ValidationContext): ValidationResult {
		// Match "N variations" patterns
		const pattern = /\d+\s+variations?/gi;
		const matches = [...text.matchAll(pattern)];

		if (matches.length === 0) {
			return pass();
		}

		const violations = matches.map((match) =>
			createViolation(
				this.name,
				this.severity,
				`Variation count "${match[0]}" is internal data. Users don't need to know this.`,
				match[0],
				match.index
			)
		);

		return fail(violations);
	}
};

// ═══════════════════════════════════════════════════════════════════════════
// Export All Validators
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_VALIDATORS: TikaValidator[] = [
	noPositionNumbers,
	noDegrees,
	noRawJSON,
	noContextData,
	brevityCheck,
	noType1Misconception,
	noVariationCounts
];
