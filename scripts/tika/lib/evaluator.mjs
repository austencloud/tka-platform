/**
 * Enhanced TIKA Response Evaluator
 *
 * Multi-dimensional scoring system for evaluating TIKA responses against scenarios.
 *
 * Dimensions:
 * - termAccuracy: Does the response include required terms?
 * - levelAppropriate: Does it avoid concepts beyond the user's level?
 * - toolUsage: Did TIKA use the expected tools?
 * - conciseness: Is the response appropriately sized?
 *
 * Weighted overall score: 35% termAccuracy + 35% levelAppropriate + 15% toolUsage + 15% conciseness
 */

/**
 * Evaluate a TIKA response against scenario criteria
 *
 * @param {Object} scenario - The test scenario
 * @param {Object} response - TIKA's response {explanation, toolsCalled, latencyMs}
 * @returns {Object} Evaluation result with scores and issues
 */
export function evaluateResponse(scenario, response) {
	const text = response.explanation?.toLowerCase() || '';

	// Calculate individual dimension scores
	const termAccuracy = checkTermAccuracy(scenario, text);
	const levelAppropriate = checkLevelAppropriateness(scenario, text);
	const toolUsage = checkToolUsage(scenario, response.toolsCalled);
	const conciseness = checkConciseness(text);

	const scores = {
		termAccuracy: termAccuracy.score,
		levelAppropriate: levelAppropriate.score,
		toolUsage: toolUsage.score,
		conciseness: conciseness.score
	};

	// Weighted overall score
	const overall = Math.round(
		scores.termAccuracy * 0.35 +
			scores.levelAppropriate * 0.35 +
			scores.toolUsage * 0.15 +
			scores.conciseness * 0.15
	);

	// Collect all issues
	const issues = [
		...termAccuracy.issues,
		...levelAppropriate.issues,
		...toolUsage.issues,
		...conciseness.issues
	];

	// Determine pass/fail
	const hasErrors = issues.some((i) => i.severity === 'error');
	const passed = overall >= 70 && !hasErrors;

	return {
		passed,
		scores,
		overall,
		issues,
		recommendation: getRecommendation(overall, hasErrors),
		details: {
			termAccuracy,
			levelAppropriate,
			toolUsage,
			conciseness
		}
	};
}

/**
 * Check if response includes required terms
 */
function checkTermAccuracy(scenario, text) {
	const mustInclude = scenario.criteria.mustInclude || [];
	const issues = [];
	let found = 0;

	for (const term of mustInclude) {
		if (text.includes(term.toLowerCase())) {
			found++;
		} else {
			issues.push({
				type: 'missing-term',
				severity: 'error',
				message: `Missing required term: "${term}"`
			});
		}
	}

	// Score: percentage of terms found
	const score = mustInclude.length > 0 ? Math.round((found / mustInclude.length) * 100) : 100;

	return { score, issues, found, total: mustInclude.length };
}

/**
 * Check if response avoids forbidden terms (level-inappropriate content)
 */
function checkLevelAppropriateness(scenario, text) {
	const mustNotInclude = scenario.criteria.mustNotInclude || [];
	const issues = [];
	let violations = 0;

	for (const term of mustNotInclude) {
		if (text.includes(term.toLowerCase())) {
			violations++;
			issues.push({
				type: 'forbidden-term',
				severity: 'error',
				message: `Contains forbidden term: "${term}"`
			});
		}
	}

	// Score: 100 if no violations, decreases by 25 for each violation
	const score = Math.max(0, 100 - violations * 25);

	return { score, issues, violations };
}

/**
 * Check if expected tools were called
 */
function checkToolUsage(scenario, toolsCalled = []) {
	const expectedTools = scenario.criteria.expectedTools || [];
	const issues = [];
	const calledToolNames = toolsCalled.map((t) => t.name);

	let found = 0;

	for (const tool of expectedTools) {
		if (calledToolNames.includes(tool)) {
			found++;
		} else {
			issues.push({
				type: 'missing-tool',
				severity: 'warning',
				message: `Expected tool not called: "${tool}"`
			});
		}
	}

	// Score: percentage of expected tools called
	const score = expectedTools.length > 0 ? Math.round((found / expectedTools.length) * 100) : 100;

	return {
		score,
		issues,
		found,
		total: expectedTools.length,
		called: calledToolNames
	};
}

/**
 * Check response length for conciseness
 * Ideal range: 100-500 characters for Level 1, adjusts by level
 */
function checkConciseness(text) {
	const length = text.length;
	const issues = [];

	// Define ideal ranges
	const minIdeal = 80;
	const maxIdeal = 800;

	let score = 100;

	if (length < minIdeal) {
		score = Math.round((length / minIdeal) * 100);
		issues.push({
			type: 'too-short',
			severity: 'warning',
			message: `Response too brief (${length} chars, ideal: ${minIdeal}+)`
		});
	} else if (length > maxIdeal) {
		// Score decreases gradually after max
		const overage = length - maxIdeal;
		score = Math.max(50, 100 - Math.round(overage / 20));
		if (length > maxIdeal * 2) {
			issues.push({
				type: 'too-long',
				severity: 'warning',
				message: `Response too verbose (${length} chars, ideal: <${maxIdeal})`
			});
		}
	}

	return { score, issues, length, idealRange: { min: minIdeal, max: maxIdeal } };
}

/**
 * Get a recommendation based on overall score
 */
function getRecommendation(overall, hasErrors) {
	if (hasErrors) {
		return 'fix-required';
	}
	if (overall >= 90) {
		return 'excellent';
	}
	if (overall >= 80) {
		return 'good';
	}
	if (overall >= 70) {
		return 'acceptable';
	}
	if (overall >= 60) {
		return 'needs-improvement';
	}
	return 'poor';
}

/**
 * Generate a summary of common issues across multiple evaluations
 *
 * @param {Array} evaluations - Array of evaluation results
 * @returns {Object} Summary statistics
 */
export function summarizeEvaluations(evaluations) {
	const summary = {
		total: evaluations.length,
		passed: 0,
		failed: 0,
		averageScore: 0,
		averageScores: {
			termAccuracy: 0,
			levelAppropriate: 0,
			toolUsage: 0,
			conciseness: 0
		},
		commonMissingTerms: {},
		commonForbiddenTerms: {},
		commonMissingTools: {},
		byCategory: {},
		byDifficulty: {}
	};

	if (evaluations.length === 0) return summary;

	for (const { evaluation, scenario } of evaluations) {
		// Count pass/fail
		if (evaluation.passed) {
			summary.passed++;
		} else {
			summary.failed++;
		}

		// Sum scores
		summary.averageScore += evaluation.overall;
		summary.averageScores.termAccuracy += evaluation.scores.termAccuracy;
		summary.averageScores.levelAppropriate += evaluation.scores.levelAppropriate;
		summary.averageScores.toolUsage += evaluation.scores.toolUsage;
		summary.averageScores.conciseness += evaluation.scores.conciseness;

		// Track by category
		const cat = scenario.category;
		if (!summary.byCategory[cat]) {
			summary.byCategory[cat] = { total: 0, passed: 0, avgScore: 0 };
		}
		summary.byCategory[cat].total++;
		if (evaluation.passed) summary.byCategory[cat].passed++;
		summary.byCategory[cat].avgScore += evaluation.overall;

		// Track by difficulty
		const diff = scenario.difficulty;
		if (!summary.byDifficulty[diff]) {
			summary.byDifficulty[diff] = { total: 0, passed: 0, avgScore: 0 };
		}
		summary.byDifficulty[diff].total++;
		if (evaluation.passed) summary.byDifficulty[diff].passed++;
		summary.byDifficulty[diff].avgScore += evaluation.overall;

		// Track common issues
		for (const issue of evaluation.issues) {
			if (issue.type === 'missing-term') {
				const term = issue.message.match(/: "(.+)"$/)?.[1] || issue.message;
				summary.commonMissingTerms[term] = (summary.commonMissingTerms[term] || 0) + 1;
			} else if (issue.type === 'forbidden-term') {
				const term = issue.message.match(/: "(.+)"$/)?.[1] || issue.message;
				summary.commonForbiddenTerms[term] = (summary.commonForbiddenTerms[term] || 0) + 1;
			} else if (issue.type === 'missing-tool') {
				const tool = issue.message.match(/: "(.+)"$/)?.[1] || issue.message;
				summary.commonMissingTools[tool] = (summary.commonMissingTools[tool] || 0) + 1;
			}
		}
	}

	// Calculate averages
	summary.averageScore = Math.round(summary.averageScore / evaluations.length);
	summary.averageScores.termAccuracy = Math.round(
		summary.averageScores.termAccuracy / evaluations.length
	);
	summary.averageScores.levelAppropriate = Math.round(
		summary.averageScores.levelAppropriate / evaluations.length
	);
	summary.averageScores.toolUsage = Math.round(
		summary.averageScores.toolUsage / evaluations.length
	);
	summary.averageScores.conciseness = Math.round(
		summary.averageScores.conciseness / evaluations.length
	);

	// Calculate category/difficulty averages
	for (const cat of Object.values(summary.byCategory)) {
		cat.avgScore = Math.round(cat.avgScore / cat.total);
		cat.passRate = Math.round((cat.passed / cat.total) * 100);
	}
	for (const diff of Object.values(summary.byDifficulty)) {
		diff.avgScore = Math.round(diff.avgScore / diff.total);
		diff.passRate = Math.round((diff.passed / diff.total) * 100);
	}

	// Sort common issues by frequency
	summary.commonMissingTerms = sortByFrequency(summary.commonMissingTerms);
	summary.commonForbiddenTerms = sortByFrequency(summary.commonForbiddenTerms);
	summary.commonMissingTools = sortByFrequency(summary.commonMissingTools);

	return summary;
}

/**
 * Sort an object by its values (frequency) descending
 */
function sortByFrequency(obj) {
	return Object.entries(obj)
		.sort(([, a], [, b]) => b - a)
		.reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
}
