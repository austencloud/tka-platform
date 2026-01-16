/**
 * TIKA Evaluation Runner
 *
 * Runs scenarios through TIKA and evaluates responses.
 *
 * Usage:
 *   node scripts/tika/run-evaluation.mjs              # Run all scenarios
 *   node scripts/tika/run-evaluation.mjs --dry-run   # Preview only
 *   node scripts/tika/run-evaluation.mjs --limit 5   # Run first 5 only
 */

import fs from 'fs';
import path from 'path';

const TIKA_API_URL = 'http://localhost:5173/api/tika/ask';
const SCENARIOS_FILE = path.join(process.cwd(), 'scripts/tika/scenarios.json');
const REPORTS_DIR = path.join(process.cwd(), 'scripts/tika/reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : null;

// Load scenarios
const allScenarios = JSON.parse(fs.readFileSync(SCENARIOS_FILE, 'utf-8'));
const scenarios = limit ? allScenarios.slice(0, limit) : allScenarios;

console.log('');
console.log('═'.repeat(60));
console.log('  TIKA EVALUATION RUN');
console.log('═'.repeat(60));
console.log(`  Scenarios: ${scenarios.length}${limit ? ` (limited from ${allScenarios.length})` : ''}`);
console.log(`  Mode: ${dryRun ? 'DRY RUN (preview only)' : 'LIVE'}`);
console.log(`  Time: ${new Date().toISOString()}`);
console.log('═'.repeat(60));
console.log('');

if (dryRun) {
  console.log('SCENARIOS TO RUN:\n');
  scenarios.forEach((s, i) => {
    console.log(`${i + 1}. [${s.category}] ${s.name}`);
    console.log(`   Level: ${s.userLevel}, Difficulty: ${s.difficulty}`);
    console.log(`   Q: "${s.question}"`);
    console.log(`   Must include: ${s.criteria.mustInclude.join(', ')}`);
    console.log(`   Must NOT include: ${s.criteria.mustNotInclude.join(', ') || 'None'}`);
    console.log('');
  });
  process.exit(0);
}

// Get concepts for level
function getLevelConcepts(level) {
  const concepts = {
    1: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8'],
    2: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '2.1', '2.2', '2.3'],
    3: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '2.1', '2.2', '2.3', '3.1', '3.2', '3.3'],
    4: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '2.1', '2.2', '2.3', '3.1', '3.2', '3.3', '4.1', '4.2', '4.3', '4.4', '4.5']
  };
  return concepts[level] || concepts[1];
}

// Call TIKA API
async function callTika(question, userLevel) {
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
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Check response against criteria
function evaluateResponse(scenario, response) {
  const issues = [];
  const text = response.explanation.toLowerCase();

  // Check mustInclude
  for (const term of scenario.criteria.mustInclude) {
    if (!text.includes(term.toLowerCase())) {
      issues.push({
        type: 'missing-term',
        severity: 'error',
        message: `Missing required term: "${term}"`
      });
    }
  }

  // Check mustNotInclude
  for (const term of scenario.criteria.mustNotInclude) {
    if (text.includes(term.toLowerCase())) {
      issues.push({
        type: 'forbidden-term',
        severity: 'error',
        message: `Contains forbidden term: "${term}"`
      });
    }
  }

  // Check expected tools
  const calledTools = response.toolsCalled?.map(t => t.name) || [];
  for (const tool of scenario.criteria.expectedTools) {
    if (!calledTools.includes(tool)) {
      issues.push({
        type: 'missing-tool',
        severity: 'warning',
        message: `Expected tool not called: "${tool}"`
      });
    }
  }

  return {
    passed: issues.filter(i => i.severity === 'error').length === 0,
    issues
  };
}

// Run evaluation
const results = [];
let passed = 0;
let failed = 0;
let totalLatency = 0;

for (let i = 0; i < scenarios.length; i++) {
  const scenario = scenarios[i];
  console.log(`[${i + 1}/${scenarios.length}] ${scenario.name}`);

  try {
    const response = await callTika(scenario.question, scenario.userLevel);
    const evaluation = evaluateResponse(scenario, response);

    results.push({
      scenarioId: scenario.id,
      scenario,
      response: {
        explanation: response.explanation,
        toolsCalled: response.toolsCalled || [],
        latencyMs: response.latencyMs
      },
      evaluation,
      timestamp: new Date().toISOString()
    });

    totalLatency += response.latencyMs;

    if (evaluation.passed) {
      passed++;
      console.log(`   ✓ PASSED (${response.latencyMs}ms)`);
    } else {
      failed++;
      console.log(`   ✗ FAILED (${response.latencyMs}ms)`);
      evaluation.issues.forEach(issue => {
        console.log(`     - ${issue.message}`);
      });
    }
  } catch (error) {
    failed++;
    results.push({
      scenarioId: scenario.id,
      scenario,
      response: null,
      evaluation: { passed: false, issues: [{ type: 'api-error', severity: 'error', message: error.message }] },
      timestamp: new Date().toISOString()
    });
    console.log(`   ✗ ERROR: ${error.message}`);
  }

  // Small delay between requests
  await new Promise(r => setTimeout(r, 500));
}

// Summary
console.log('');
console.log('═'.repeat(60));
console.log('  SUMMARY');
console.log('═'.repeat(60));
console.log(`  Total:      ${scenarios.length}`);
console.log(`  Passed:     ${passed} (${Math.round(passed / scenarios.length * 100)}%)`);
console.log(`  Failed:     ${failed} (${Math.round(failed / scenarios.length * 100)}%)`);
console.log(`  Avg Time:   ${Math.round(totalLatency / scenarios.length)}ms`);
console.log('═'.repeat(60));
console.log('');

// Categorize failures
const failedResults = results.filter(r => !r.evaluation.passed);
if (failedResults.length > 0) {
  console.log('FAILED SCENARIOS:\n');

  const byCategory = {};
  for (const result of failedResults) {
    const cat = result.scenario.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(result);
  }

  for (const [category, items] of Object.entries(byCategory)) {
    console.log(`  ${category}:`);
    for (const item of items) {
      console.log(`    - ${item.scenario.name}`);
      item.evaluation.issues.forEach(issue => {
        console.log(`      ${issue.type}: ${issue.message}`);
      });
    }
    console.log('');
  }
}

// Save full report
const reportFile = path.join(REPORTS_DIR, `eval-${Date.now()}.json`);
const report = {
  runId: `eval-${Date.now()}`,
  startedAt: new Date().toISOString(),
  summary: {
    total: scenarios.length,
    passed,
    failed,
    passRate: Math.round(passed / scenarios.length * 100),
    averageLatencyMs: Math.round(totalLatency / scenarios.length)
  },
  results
};

fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(`Full report saved to: ${reportFile}`);

// Also save a human-readable summary for flagged items
const flaggedFile = path.join(REPORTS_DIR, `flagged-${Date.now()}.md`);
let flaggedContent = `# TIKA Evaluation - Flagged Items\n\n`;
flaggedContent += `**Run:** ${report.runId}\n`;
flaggedContent += `**Date:** ${new Date().toLocaleString()}\n`;
flaggedContent += `**Pass Rate:** ${report.summary.passRate}%\n\n`;
flaggedContent += `---\n\n`;

for (const result of failedResults) {
  flaggedContent += `## ${result.scenario.name}\n\n`;
  flaggedContent += `**ID:** ${result.scenarioId}\n`;
  flaggedContent += `**Category:** ${result.scenario.category}\n`;
  flaggedContent += `**Difficulty:** ${result.scenario.difficulty}\n\n`;
  flaggedContent += `### Question\n\n> ${result.scenario.question}\n\n`;
  flaggedContent += `### TIKA's Response\n\n${result.response?.explanation || 'No response'}\n\n`;
  flaggedContent += `### Issues Found\n\n`;
  for (const issue of result.evaluation.issues) {
    flaggedContent += `- **${issue.type}**: ${issue.message}\n`;
  }
  flaggedContent += `\n### Expected Key Facts\n\n`;
  for (const fact of result.scenario.criteria.keyFacts) {
    flaggedContent += `- ${fact}\n`;
  }
  flaggedContent += `\n---\n\n`;
}

fs.writeFileSync(flaggedFile, flaggedContent);
console.log(`Flagged items saved to: ${flaggedFile}`);
console.log('');
