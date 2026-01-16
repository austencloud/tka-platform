/**
 * TIKA Evaluation Runner
 *
 * Runs scenarios through TIKA and collects responses for evaluation.
 * Can optionally send results to Opus for review.
 *
 * Usage:
 *   npx tsx scripts/tika/evaluate.ts                    # Run all scenarios
 *   npx tsx scripts/tika/evaluate.ts --category letter  # Filter by category
 *   npx tsx scripts/tika/evaluate.ts --level 1          # Filter by level
 *   npx tsx scripts/tika/evaluate.ts --with-opus        # Include Opus review
 *   npx tsx scripts/tika/evaluate.ts --dry-run          # Just show scenarios
 */

import fs from 'fs';
import path from 'path';
import {
	baselineScenarios,
	filterScenarios
} from '../../src/lib/features/learn/tika/evaluation/scenarios/baseline-scenarios';
import type { TikaScenario } from '../../src/lib/features/learn/tika/evaluation/types';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface HaikuResponse {
	explanation: string;
	toolsCalled: Array<{
		name: string;
		input: Record<string, unknown>;
		result: unknown;
	}>;
	latencyMs: number;
	showPictograph: boolean;
	pictographLetter?: string;
}

interface EvaluationRun {
	runId: string;
	startedAt: Date;
	completedAt?: Date;
	scenarios: TikaScenario[];
	results: Array<{
		scenarioId: string;
		scenario: TikaScenario;
		haikuResponse: HaikuResponse | null;
		error?: string;
	}>;
	summary?: {
		total: number;
		successful: number;
		failed: number;
		averageLatencyMs: number;
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const TIKA_API_URL = 'http://localhost:5173/api/tika/ask';
const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/tika/reports');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// API Client
// ═══════════════════════════════════════════════════════════════════════════

async function callTikaApi(question: string, userLevel: number): Promise<HaikuResponse> {
	const response = await fetch(TIKA_API_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			question,
			userId: 'evaluation-runner',
			completedConcepts: getLevelConcepts(userLevel),
			language: 'en'
		})
	});

	if (!response.ok) {
		throw new Error(`API error: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get completed concepts for a given level (to pass to TIKA API)
 */
function getLevelConcepts(level: number): string[] {
	const conceptsByLevel: Record<number, string[]> = {
		1: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8'],
		2: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '2.1', '2.2', '2.3'],
		3: [
			'1.1',
			'1.2',
			'1.3',
			'1.4',
			'1.5',
			'1.6',
			'1.7',
			'1.8',
			'2.1',
			'2.2',
			'2.3',
			'3.1',
			'3.2',
			'3.3'
		],
		4: [
			'1.1',
			'1.2',
			'1.3',
			'1.4',
			'1.5',
			'1.6',
			'1.7',
			'1.8',
			'2.1',
			'2.2',
			'2.3',
			'3.1',
			'3.2',
			'3.3',
			'4.1',
			'4.2',
			'4.3',
			'4.4',
			'4.5'
		]
	};
	return conceptsByLevel[level] || conceptsByLevel[1];
}

// ═══════════════════════════════════════════════════════════════════════════
// Evaluation Runner
// ═══════════════════════════════════════════════════════════════════════════

async function runEvaluation(scenarios: TikaScenario[], options: { dryRun?: boolean }): Promise<EvaluationRun> {
	const runId = `eval-${Date.now()}`;
	const run: EvaluationRun = {
		runId,
		startedAt: new Date(),
		scenarios,
		results: []
	};

	console.log(`\n${'='.repeat(60)}`);
	console.log(`TIKA Evaluation Run: ${runId}`);
	console.log(`Scenarios: ${scenarios.length}`);
	console.log(`${'='.repeat(60)}\n`);

	if (options.dryRun) {
		console.log('DRY RUN - Showing scenarios only:\n');
		scenarios.forEach((s, i) => {
			console.log(`${i + 1}. [${s.category}] ${s.name.en}`);
			console.log(`   Level: ${s.userLevel}, Difficulty: ${s.difficulty}`);
			console.log(`   Question: "${s.question.en}"`);
			console.log('');
		});
		return run;
	}

	let successCount = 0;
	let failCount = 0;
	let totalLatency = 0;

	for (let i = 0; i < scenarios.length; i++) {
		const scenario = scenarios[i];
		console.log(`[${i + 1}/${scenarios.length}] ${scenario.name.en}`);

		try {
			const response = await callTikaApi(scenario.question.en, scenario.userLevel);

			run.results.push({
				scenarioId: scenario.id,
				scenario,
				haikuResponse: response
			});

			successCount++;
			totalLatency += response.latencyMs;

			console.log(`   ✓ Response received (${response.latencyMs}ms)`);
			console.log(`   Tools: ${response.toolsCalled.map((t) => t.name).join(', ') || 'None'}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			run.results.push({
				scenarioId: scenario.id,
				scenario,
				haikuResponse: null,
				error: errorMessage
			});

			failCount++;
			console.log(`   ✗ Error: ${errorMessage}`);
		}

		// Small delay between requests
		await new Promise((r) => setTimeout(r, 500));
	}

	run.completedAt = new Date();
	run.summary = {
		total: scenarios.length,
		successful: successCount,
		failed: failCount,
		averageLatencyMs: successCount > 0 ? Math.round(totalLatency / successCount) : 0
	};

	console.log(`\n${'='.repeat(60)}`);
	console.log('SUMMARY');
	console.log(`${'='.repeat(60)}`);
	console.log(`Total:    ${run.summary.total}`);
	console.log(`Success:  ${run.summary.successful}`);
	console.log(`Failed:   ${run.summary.failed}`);
	console.log(`Avg Time: ${run.summary.averageLatencyMs}ms`);
	console.log(`${'='.repeat(60)}\n`);

	return run;
}

// ═══════════════════════════════════════════════════════════════════════════
// Quick Analysis (without Opus)
// ═══════════════════════════════════════════════════════════════════════════

function quickAnalyze(run: EvaluationRun): void {
	console.log('\n📊 QUICK ANALYSIS (Automated Checks)\n');

	const issues: string[] = [];

	for (const result of run.results) {
		if (!result.haikuResponse) continue;

		const { scenario, haikuResponse } = result;
		const response = haikuResponse.explanation.toLowerCase();

		// Check mustInclude
		for (const term of scenario.criteria.mustInclude) {
			if (!response.includes(term.toLowerCase())) {
				issues.push(`[${scenario.id}] Missing required term: "${term}"`);
			}
		}

		// Check mustNotInclude
		for (const term of scenario.criteria.mustNotInclude) {
			if (response.includes(term.toLowerCase())) {
				issues.push(`[${scenario.id}] Contains forbidden term: "${term}"`);
			}
		}

		// Check expected tools
		const calledTools = haikuResponse.toolsCalled.map((t) => t.name);
		for (const tool of scenario.criteria.expectedTools) {
			if (!calledTools.includes(tool)) {
				issues.push(`[${scenario.id}] Expected tool not called: "${tool}"`);
			}
		}
	}

	if (issues.length === 0) {
		console.log('✓ All automated checks passed!\n');
	} else {
		console.log(`Found ${issues.length} issues:\n`);
		issues.forEach((issue) => console.log(`  ⚠️  ${issue}`));
		console.log('');
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Save Results
// ═══════════════════════════════════════════════════════════════════════════

function saveResults(run: EvaluationRun): string {
	const filename = `${run.runId}.json`;
	const filepath = path.join(OUTPUT_DIR, filename);

	fs.writeFileSync(filepath, JSON.stringify(run, null, 2));
	console.log(`Results saved to: ${filepath}`);

	return filepath;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
	const args = process.argv.slice(2);

	if (args.includes('--help')) {
		console.log(`
TIKA Evaluation Runner

Usage:
  npx tsx scripts/tika/evaluate.ts [options]

Options:
  --category <cat>   Filter by category (letter-explanation, term-definition, etc.)
  --level <1-4>      Filter by user level
  --difficulty <d>   Filter by difficulty (easy, medium, hard, edge-case)
  --dry-run          Show scenarios without running
  --with-opus        Run Opus review after (not yet implemented)
  --output <file>    Custom output filename

Categories:
  letter-explanation, term-definition, letter-comparison,
  misconception-correction, concept-question, edge-case
`);
		return;
	}

	// Parse filters
	const categoryIdx = args.indexOf('--category');
	const levelIdx = args.indexOf('--level');
	const difficultyIdx = args.indexOf('--difficulty');

	const category = categoryIdx >= 0 ? args[categoryIdx + 1] : undefined;
	const level = levelIdx >= 0 ? (parseInt(args[levelIdx + 1]) as 1 | 2 | 3 | 4) : undefined;
	const difficulty = difficultyIdx >= 0 ? (args[difficultyIdx + 1] as 'easy' | 'medium' | 'hard' | 'edge-case') : undefined;

	const dryRun = args.includes('--dry-run');
	const withOpus = args.includes('--with-opus');

	// Filter scenarios
	let scenarios: TikaScenario[];
	if (category || level || difficulty) {
		scenarios = filterScenarios({ category, level, difficulty });
		console.log(`Filtered to ${scenarios.length} scenarios`);
	} else {
		scenarios = baselineScenarios;
	}

	if (scenarios.length === 0) {
		console.log('No scenarios match the filters.');
		return;
	}

	// Run evaluation
	const run = await runEvaluation(scenarios, { dryRun });

	if (!dryRun) {
		// Quick automated analysis
		quickAnalyze(run);

		// Save results
		const filepath = saveResults(run);

		if (withOpus) {
			console.log('\n⚠️  Opus review requested but not yet integrated.');
			console.log(`Run manually: npx tsx scripts/tika/opus-reviewer.ts --input ${filepath}`);
		}
	}
}

main().catch(console.error);
