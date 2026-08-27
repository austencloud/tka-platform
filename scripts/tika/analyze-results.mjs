/**
 * TIKA Evaluation Analyzer
 *
 * Aggregates analysis across multiple evaluation runs to identify trends,
 * weak spots, and generate improvement suggestions.
 *
 * Usage:
 *   node scripts/tika/analyze-results.mjs              # Analyze all reports
 *   node scripts/tika/analyze-results.mjs --last 5    # Analyze last 5 reports
 *   node scripts/tika/analyze-results.mjs --since 2024-01-01  # Since date
 */

import fs from 'fs';
import path from 'path';

const REPORTS_DIR = path.join(process.cwd(), 'scripts/tika/reports');

const args = process.argv.slice(2);
const lastIdx = args.indexOf('--last');
const lastN = lastIdx >= 0 ? parseInt(args[lastIdx + 1]) : null;
const sinceIdx = args.indexOf('--since');
const sinceDate = sinceIdx >= 0 ? new Date(args[sinceIdx + 1]) : null;

// Load all report files
function loadReports() {
	if (!fs.existsSync(REPORTS_DIR)) {
		console.error('No reports directory found. Run evaluations first.');
		process.exit(1);
	}

	const files = fs
		.readdirSync(REPORTS_DIR)
		.filter((f) => f.startsWith('eval-') && f.endsWith('.json'))
		.sort()
		.reverse(); // Most recent first

	if (files.length === 0) {
		console.error('No evaluation reports found. Run evaluations first.');
		process.exit(1);
	}

	let selectedFiles = files;

	if (lastN) {
		selectedFiles = files.slice(0, lastN);
	} else if (sinceDate) {
		selectedFiles = files.filter((f) => {
			const timestamp = parseInt(f.replace('eval-', '').replace('.json', ''));
			return new Date(timestamp) >= sinceDate;
		});
	}

	return selectedFiles.map((f) => {
		const content = fs.readFileSync(path.join(REPORTS_DIR, f), 'utf-8');
		return JSON.parse(content);
	});
}

const reports = loadReports();

console.log('');
console.log('═'.repeat(60));
console.log('  TIKA EVALUATION ANALYSIS');
console.log('═'.repeat(60));
console.log(`  Reports analyzed: ${reports.length}`);
console.log(`  Date range: ${new Date(reports[reports.length - 1].startedAt).toLocaleDateString()} - ${new Date(reports[0].startedAt).toLocaleDateString()}`);
console.log('═'.repeat(60));
console.log('');

// Aggregate statistics
const aggregate = {
	totalRuns: reports.length,
	totalScenarios: 0,
	totalPassed: 0,
	totalFailed: 0,
	passRates: [],
	latencies: [],
	byCategory: {},
	byDifficulty: {},
	missingTerms: {},
	forbiddenTerms: {},
	missingTools: {},
	scenarioPerformance: {}
};

for (const report of reports) {
	aggregate.totalScenarios += report.summary.total;
	aggregate.totalPassed += report.summary.passed;
	aggregate.totalFailed += report.summary.failed;
	aggregate.passRates.push(report.summary.passRate);
	aggregate.latencies.push(report.summary.averageLatencyMs);

	// Aggregate by category
	for (const [category, data] of Object.entries(report.summary.byCategory || {})) {
		if (!aggregate.byCategory[category]) {
			aggregate.byCategory[category] = { runs: 0, totalPassed: 0, totalFailed: 0, avgScores: [] };
		}
		aggregate.byCategory[category].runs++;
		aggregate.byCategory[category].totalPassed += data.passed || 0;
		aggregate.byCategory[category].totalFailed += (data.total || 0) - (data.passed || 0);
		aggregate.byCategory[category].avgScores.push(data.avgScore || 0);
	}

	// Aggregate by difficulty
	for (const [difficulty, data] of Object.entries(report.summary.byDifficulty || {})) {
		if (!aggregate.byDifficulty[difficulty]) {
			aggregate.byDifficulty[difficulty] = { runs: 0, totalPassed: 0, totalFailed: 0, avgScores: [] };
		}
		aggregate.byDifficulty[difficulty].runs++;
		aggregate.byDifficulty[difficulty].totalPassed += data.passed || 0;
		aggregate.byDifficulty[difficulty].totalFailed += (data.total || 0) - (data.passed || 0);
		aggregate.byDifficulty[difficulty].avgScores.push(data.avgScore || 0);
	}

	// Aggregate issues
	for (const [term, count] of Object.entries(report.issues?.commonMissingTerms || {})) {
		aggregate.missingTerms[term] = (aggregate.missingTerms[term] || 0) + count;
	}
	for (const [term, count] of Object.entries(report.issues?.commonForbiddenTerms || {})) {
		aggregate.forbiddenTerms[term] = (aggregate.forbiddenTerms[term] || 0) + count;
	}
	for (const [tool, count] of Object.entries(report.issues?.commonMissingTools || {})) {
		aggregate.missingTools[tool] = (aggregate.missingTools[tool] || 0) + count;
	}

	// Track individual scenario performance
	for (const result of report.results || []) {
		const id = result.scenarioId;
		if (!aggregate.scenarioPerformance[id]) {
			aggregate.scenarioPerformance[id] = {
				name: result.scenario?.name || id,
				category: result.scenario?.category,
				runs: 0,
				passed: 0,
				scores: []
			};
		}
		aggregate.scenarioPerformance[id].runs++;
		if (result.evaluation?.passed) {
			aggregate.scenarioPerformance[id].passed++;
		}
		if (result.evaluation?.overall != null) {
			aggregate.scenarioPerformance[id].scores.push(result.evaluation.overall);
		}
	}
}

// Calculate aggregated metrics
const avgPassRate = Math.round(aggregate.passRates.reduce((a, b) => a + b, 0) / aggregate.passRates.length);
const avgLatency = Math.round(aggregate.latencies.reduce((a, b) => a + b, 0) / aggregate.latencies.length);

console.log('OVERALL PERFORMANCE:\n');
console.log(`  Total evaluations:  ${aggregate.totalScenarios}`);
console.log(`  Average pass rate:  ${avgPassRate}%`);
console.log(`  Average latency:    ${avgLatency}ms`);
console.log(`  Pass rate trend:    ${getTrend(aggregate.passRates)}`);
console.log('');

// Category analysis
console.log('PERFORMANCE BY CATEGORY:\n');
const categoryResults = [];
for (const [category, data] of Object.entries(aggregate.byCategory)) {
	const total = data.totalPassed + data.totalFailed;
	const passRate = Math.round((data.totalPassed / total) * 100);
	const avgScore = Math.round(data.avgScores.reduce((a, b) => a + b, 0) / data.avgScores.length);
	categoryResults.push({ category, passRate, avgScore, total });
}
categoryResults.sort((a, b) => a.passRate - b.passRate);

for (const { category, passRate, avgScore, total } of categoryResults) {
	const status = passRate >= 80 ? '✓' : passRate >= 60 ? '⚠' : '✗';
	console.log(`  ${status} ${category}: ${passRate}% pass (avg score: ${avgScore}, n=${total})`);
}
console.log('');

// Difficulty analysis
console.log('PERFORMANCE BY DIFFICULTY:\n');
const difficultyOrder = ['easy', 'medium', 'hard'];
for (const difficulty of difficultyOrder) {
	const data = aggregate.byDifficulty[difficulty];
	if (!data) continue;
	const total = data.totalPassed + data.totalFailed;
	const passRate = Math.round((data.totalPassed / total) * 100);
	const avgScore = Math.round(data.avgScores.reduce((a, b) => a + b, 0) / data.avgScores.length);
	const status = passRate >= 80 ? '✓' : passRate >= 60 ? '⚠' : '✗';
	console.log(`  ${status} ${difficulty}: ${passRate}% pass (avg score: ${avgScore}, n=${total})`);
}
console.log('');

// Problematic scenarios (consistently failing)
console.log('CONSISTENTLY FAILING SCENARIOS:\n');
const problematic = Object.entries(aggregate.scenarioPerformance)
	.map(([id, data]) => ({
		id,
		...data,
		passRate: Math.round((data.passed / data.runs) * 100),
		avgScore: data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : 0
	}))
	.filter((s) => s.passRate < 50 && s.runs >= 2) // At least 2 runs, less than 50% pass
	.sort((a, b) => a.passRate - b.passRate);

if (problematic.length === 0) {
	console.log('  No consistently failing scenarios found.\n');
} else {
	for (const scenario of problematic.slice(0, 10)) {
		console.log(`  ✗ ${scenario.name}`);
		console.log(`    Pass rate: ${scenario.passRate}% (${scenario.passed}/${scenario.runs})`);
		console.log(`    Avg score: ${scenario.avgScore}`);
		console.log(`    Category: ${scenario.category}`);
		console.log('');
	}
}

// Most common issues
console.log('TOP MISSING TERMS (across all runs):\n');
const topMissing = Object.entries(aggregate.missingTerms)
	.sort(([, a], [, b]) => b - a)
	.slice(0, 10);
if (topMissing.length === 0) {
	console.log('  None\n');
} else {
	for (const [term, count] of topMissing) {
		console.log(`  - "${term}" (${count} occurrences)`);
	}
	console.log('');
}

console.log('TOP FORBIDDEN TERMS USED (level violations):\n');
const topForbidden = Object.entries(aggregate.forbiddenTerms)
	.sort(([, a], [, b]) => b - a)
	.slice(0, 10);
if (topForbidden.length === 0) {
	console.log('  None\n');
} else {
	for (const [term, count] of topForbidden) {
		console.log(`  - "${term}" (${count} occurrences)`);
	}
	console.log('');
}

console.log('TOP EXPECTED BUT UNUSED TOOLS:\n');
const topUnusedTools = Object.entries(aggregate.missingTools)
	.sort(([, a], [, b]) => b - a)
	.slice(0, 5);
if (topUnusedTools.length === 0) {
	console.log('  None\n');
} else {
	for (const [tool, count] of topUnusedTools) {
		console.log(`  - ${tool} (${count} times)`);
	}
	console.log('');
}

// Generate improvement suggestions
console.log('═'.repeat(60));
console.log('  IMPROVEMENT SUGGESTIONS');
console.log('═'.repeat(60));
console.log('');

const suggestions = [];

// Suggestion based on weak categories
const weakCategories = categoryResults.filter((c) => c.passRate < 70);
if (weakCategories.length > 0) {
	suggestions.push({
		priority: 'HIGH',
		area: 'Categories',
		suggestion: `Focus on improving responses in these categories: ${weakCategories.map((c) => c.category).join(', ')}`
	});
}

// Suggestion based on common missing terms
if (topMissing.length > 0) {
	suggestions.push({
		priority: 'MEDIUM',
		area: 'Terminology',
		suggestion: `TIKA often fails to include these key terms: ${topMissing.slice(0, 3).map(([t]) => `"${t}"`).join(', ')}. Consider reinforcing these in the system prompt.`
	});
}

// Suggestion based on level violations
if (topForbidden.length > 0) {
	suggestions.push({
		priority: 'HIGH',
		area: 'Level Awareness',
		suggestion: `TIKA frequently uses level-inappropriate terms: ${topForbidden.slice(0, 3).map(([t]) => `"${t}"`).join(', ')}. Strengthen level constraints in the system prompt.`
	});
}

// Suggestion based on tool usage
if (topUnusedTools.length > 0) {
	suggestions.push({
		priority: 'LOW',
		area: 'Tool Usage',
		suggestion: `TIKA doesn't use these expected tools: ${topUnusedTools.slice(0, 3).map(([t]) => t).join(', ')}. Review whether these tools should be called more often.`
	});
}

// Suggestion based on pass rate trend
if (aggregate.passRates.length >= 3) {
	const recent = aggregate.passRates.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
	const earlier = aggregate.passRates.slice(-3).reduce((a, b) => a + b, 0) / 3;
	if (recent < earlier - 10) {
		suggestions.push({
			priority: 'HIGH',
			area: 'Regression',
			suggestion: `Pass rate has decreased from ${Math.round(earlier)}% to ${Math.round(recent)}%. Investigate recent changes to TIKA's prompts or tools.`
		});
	} else if (recent > earlier + 10) {
		suggestions.push({
			priority: 'INFO',
			area: 'Progress',
			suggestion: `Pass rate has improved from ${Math.round(earlier)}% to ${Math.round(recent)}%. Recent changes are working well.`
		});
	}
}

// Print suggestions
if (suggestions.length === 0) {
	console.log('  No specific suggestions at this time. Overall performance looks good.\n');
} else {
	for (const { priority, area, suggestion } of suggestions) {
		const icon = priority === 'HIGH' ? '🔴' : priority === 'MEDIUM' ? '🟡' : priority === 'LOW' ? '🟢' : 'ℹ️';
		console.log(`${icon} [${priority}] ${area}`);
		console.log(`   ${suggestion}\n`);
	}
}

// Save analysis report
const analysisFile = path.join(REPORTS_DIR, `analysis-${Date.now()}.md`);
let analysisContent = `# TIKA Evaluation Analysis\n\n`;
analysisContent += `**Generated:** ${new Date().toLocaleString()}\n`;
analysisContent += `**Reports Analyzed:** ${reports.length}\n`;
analysisContent += `**Date Range:** ${new Date(reports[reports.length - 1].startedAt).toLocaleDateString()} - ${new Date(reports[0].startedAt).toLocaleDateString()}\n\n`;
analysisContent += `---\n\n`;

analysisContent += `## Overall Performance\n\n`;
analysisContent += `- Total evaluations: ${aggregate.totalScenarios}\n`;
analysisContent += `- Average pass rate: ${avgPassRate}%\n`;
analysisContent += `- Average latency: ${avgLatency}ms\n`;
analysisContent += `- Pass rate trend: ${getTrend(aggregate.passRates)}\n\n`;

analysisContent += `## Performance by Category\n\n`;
analysisContent += `| Category | Pass Rate | Avg Score | Count |\n`;
analysisContent += `|----------|-----------|-----------|-------|\n`;
for (const { category, passRate, avgScore, total } of categoryResults) {
	analysisContent += `| ${category} | ${passRate}% | ${avgScore} | ${total} |\n`;
}
analysisContent += `\n`;

analysisContent += `## Consistently Failing Scenarios\n\n`;
if (problematic.length === 0) {
	analysisContent += `No consistently failing scenarios.\n\n`;
} else {
	for (const scenario of problematic.slice(0, 10)) {
		analysisContent += `### ${scenario.name}\n`;
		analysisContent += `- Pass rate: ${scenario.passRate}%\n`;
		analysisContent += `- Average score: ${scenario.avgScore}\n`;
		analysisContent += `- Category: ${scenario.category}\n\n`;
	}
}

analysisContent += `## Improvement Suggestions\n\n`;
for (const { priority, area, suggestion } of suggestions) {
	analysisContent += `### [${priority}] ${area}\n\n${suggestion}\n\n`;
}

fs.writeFileSync(analysisFile, analysisContent);
console.log(`Analysis saved to: ${analysisFile}`);
console.log('');

// Helper function
function getTrend(values) {
	if (values.length < 3) return 'Insufficient data';

	const recent = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
	const earlier = values.slice(-3).reduce((a, b) => a + b, 0) / 3;

	if (recent > earlier + 5) return '📈 Improving';
	if (recent < earlier - 5) return '📉 Declining';
	return '➡️ Stable';
}
