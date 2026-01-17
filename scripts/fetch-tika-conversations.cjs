#!/usr/bin/env node

/**
 * TIKA Conversations CLI
 *
 * Fetch and manage TIKA evaluation results for review.
 *
 * Usage:
 *   node scripts/fetch-tika-conversations.js                    # List pending
 *   node scripts/fetch-tika-conversations.js --status pending   # Filter by status
 *   node scripts/fetch-tika-conversations.js <id>               # Show specific item
 *   node scripts/fetch-tika-conversations.js <id> approve "notes"
 *   node scripts/fetch-tika-conversations.js <id> flag "notes"
 *   node scripts/fetch-tika-conversations.js stats              # Show metrics
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.resolve(__dirname, 'tika/reports');
const RESOLUTIONS_FILE = path.resolve(REPORTS_DIR, 'resolutions.json');

// ═══════════════════════════════════════════════════════════════════════════
// Data Loading
// ═══════════════════════════════════════════════════════════════════════════

function loadResolutions() {
	if (fs.existsSync(RESOLUTIONS_FILE)) {
		return JSON.parse(fs.readFileSync(RESOLUTIONS_FILE, 'utf-8'));
	}
	return {};
}

function saveResolutions(resolutions) {
	fs.writeFileSync(RESOLUTIONS_FILE, JSON.stringify(resolutions, null, 2));
}

function loadLatestReport() {
	if (!fs.existsSync(REPORTS_DIR)) {
		return null;
	}

	const files = fs.readdirSync(REPORTS_DIR)
		.filter(f => f.startsWith('eval-') && f.endsWith('.json'));

	if (files.length === 0) {
		return null;
	}

	files.sort().reverse();
	const reportPath = path.join(REPORTS_DIR, files[0]);
	return JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
}

function getFlaggedItems(statusFilter = null) {
	const report = loadLatestReport();
	if (!report) {
		return { items: [], summary: null };
	}

	const resolutions = loadResolutions();

	const items = report.results
		.filter(r => !r.evaluation.passed)
		.map(result => {
			const itemId = `${report.runId}-${result.scenarioId}`;
			const resolution = resolutions[itemId];

			let status = 'pending';
			if (resolution) {
				status = resolution.status || 'approved';
			}

			return {
				id: itemId,
				scenarioId: result.scenarioId,
				scenarioName: result.scenario.name,
				category: result.scenario.category,
				difficulty: result.scenario.difficulty,
				userLevel: result.scenario.userLevel,
				question: result.scenario.question,
				tikaResponse: result.response?.explanation || 'No response',
				toolsCalled: result.response?.toolsCalled?.map(t => t.name) || [],
				issues: result.evaluation.issues,
				expectedKeyFacts: result.scenario.criteria.keyFacts,
				timestamp: result.timestamp,
				status,
				resolution
			};
		});

	const filteredItems = statusFilter
		? items.filter(i => i.status === statusFilter)
		: items;

	return {
		items: filteredItems,
		summary: {
			total: items.length,
			pending: items.filter(i => i.status === 'pending').length,
			approved: items.filter(i => i.status === 'approved').length,
			flagged: items.filter(i => i.status === 'flagged').length,
			passRate: report.summary.passRate,
			runId: report.runId,
			runDate: report.startedAt
		}
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Commands
// ═══════════════════════════════════════════════════════════════════════════

function listItems(statusFilter, limit = 10) {
	const { items, summary } = getFlaggedItems(statusFilter);

	if (!summary) {
		console.log('No evaluation reports found. Run an evaluation first.');
		return;
	}

	console.log('\n══════════════════════════════════════════════════════════════');
	console.log('TIKA REVIEW QUEUE');
	console.log('══════════════════════════════════════════════════════════════\n');

	console.log(`Run: ${summary.runId}`);
	console.log(`Date: ${new Date(summary.runDate).toLocaleString()}`);
	console.log(`Pass Rate: ${summary.passRate}%`);
	console.log(`\nPending: ${summary.pending} | Approved: ${summary.approved} | Flagged: ${summary.flagged}\n`);

	if (items.length === 0) {
		console.log(statusFilter
			? `No ${statusFilter} items found.`
			: 'No items found.');
		return;
	}

	console.log('──────────────────────────────────────────────────────────────');

	const displayItems = items.slice(0, limit);
	displayItems.forEach((item, i) => {
		const statusIcon = {
			pending: '⏳',
			approved: '✅',
			flagged: '🚩'
		}[item.status] || '❓';

		console.log(`\n${i + 1}. ${statusIcon} [${item.category}] ${item.scenarioName}`);
		console.log(`   ID: ${item.id}`);
		console.log(`   Level: ${item.userLevel} | Difficulty: ${item.difficulty}`);
		console.log(`   Issues: ${item.issues.map(i => i.type).join(', ')}`);

		if (item.resolution?.notes) {
			console.log(`   Notes: ${item.resolution.notes}`);
		}
	});

	if (items.length > limit) {
		console.log(`\n... and ${items.length - limit} more items`);
	}

	console.log('\n══════════════════════════════════════════════════════════════\n');
}

function showItem(itemId) {
	const { items } = getFlaggedItems();
	const item = items.find(i => i.id === itemId || i.id.endsWith(itemId));

	if (!item) {
		console.log(`Item not found: ${itemId}`);
		return;
	}

	console.log('\n══════════════════════════════════════════════════════════════');
	console.log(`TIKA REVIEW: ${item.scenarioName}`);
	console.log('══════════════════════════════════════════════════════════════\n');

	console.log(`ID: ${item.id}`);
	console.log(`Category: ${item.category}`);
	console.log(`Level: ${item.userLevel} | Difficulty: ${item.difficulty}`);
	console.log(`Status: ${item.status}`);

	console.log('\n── QUESTION ──────────────────────────────────────────────────\n');
	console.log(item.question);

	console.log('\n── TIKA RESPONSE ─────────────────────────────────────────────\n');
	console.log(item.tikaResponse);

	console.log('\n── ISSUES DETECTED ───────────────────────────────────────────\n');
	item.issues.forEach(issue => {
		console.log(`• [${issue.severity}] ${issue.type}: ${issue.message}`);
	});

	console.log('\n── EXPECTED KEY FACTS ────────────────────────────────────────\n');
	item.expectedKeyFacts.forEach(fact => {
		console.log(`• ${fact}`);
	});

	if (item.toolsCalled.length > 0) {
		console.log('\n── TOOLS CALLED ──────────────────────────────────────────────\n');
		console.log(item.toolsCalled.join(', '));
	}

	if (item.resolution) {
		console.log('\n── RESOLUTION ────────────────────────────────────────────────\n');
		console.log(`Resolved: ${new Date(item.resolution.resolvedAt).toLocaleString()}`);
		console.log(`By: ${item.resolution.resolvedBy}`);
		if (item.resolution.notes) {
			console.log(`Notes: ${item.resolution.notes}`);
		}
	}

	console.log('\n══════════════════════════════════════════════════════════════\n');
}

function approveItem(itemId, notes = '') {
	const { items } = getFlaggedItems();
	const item = items.find(i => i.id === itemId || i.id.endsWith(itemId));

	if (!item) {
		console.log(`Item not found: ${itemId}`);
		return;
	}

	const resolutions = loadResolutions();
	resolutions[item.id] = {
		status: 'approved',
		resolvedAt: new Date().toISOString(),
		resolvedBy: 'opus-reviewer',
		notes
	};
	saveResolutions(resolutions);

	console.log(`✅ Approved: ${item.id}`);
	if (notes) console.log(`   Notes: ${notes}`);
}

function flagItem(itemId, notes = '') {
	const { items } = getFlaggedItems();
	const item = items.find(i => i.id === itemId || i.id.endsWith(itemId));

	if (!item) {
		console.log(`Item not found: ${itemId}`);
		return;
	}

	const resolutions = loadResolutions();
	resolutions[item.id] = {
		status: 'flagged',
		resolvedAt: new Date().toISOString(),
		resolvedBy: 'opus-reviewer',
		notes
	};
	saveResolutions(resolutions);

	console.log(`🚩 Flagged for human review: ${item.id}`);
	if (notes) console.log(`   Notes: ${notes}`);
}

function showStats() {
	const { items, summary } = getFlaggedItems();

	if (!summary) {
		console.log('No evaluation reports found.');
		return;
	}

	console.log('\n══════════════════════════════════════════════════════════════');
	console.log('TIKA QUALITY METRICS');
	console.log('══════════════════════════════════════════════════════════════\n');

	console.log(`Last Run: ${new Date(summary.runDate).toLocaleString()}`);
	console.log(`Pass Rate: ${summary.passRate}%\n`);

	console.log('Status Breakdown:');
	console.log(`  Pending:  ${summary.pending}`);
	console.log(`  Approved: ${summary.approved}`);
	console.log(`  Flagged:  ${summary.flagged}`);
	console.log(`  Total:    ${summary.total}\n`);

	// Issue type breakdown
	const issueTypes = {};
	items.forEach(item => {
		item.issues.forEach(issue => {
			issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
		});
	});

	console.log('Common Issues:');
	Object.entries(issueTypes)
		.sort((a, b) => b[1] - a[1])
		.forEach(([type, count]) => {
			console.log(`  ${type}: ${count}`);
		});

	// Category breakdown
	const categories = {};
	items.forEach(item => {
		categories[item.category] = (categories[item.category] || 0) + 1;
	});

	console.log('\nBy Category:');
	Object.entries(categories)
		.sort((a, b) => b[1] - a[1])
		.forEach(([cat, count]) => {
			console.log(`  ${cat}: ${count}`);
		});

	console.log('\n══════════════════════════════════════════════════════════════\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);

if (args.length === 0) {
	// Default: list pending
	listItems('pending');
} else if (args[0] === 'stats') {
	showStats();
} else if (args[0] === '--status') {
	listItems(args[1], parseInt(args[2]) || 10);
} else if (args[0] === '--limit') {
	listItems(null, parseInt(args[1]) || 10);
} else if (args[1] === 'approve') {
	approveItem(args[0], args[2] || '');
} else if (args[1] === 'flag') {
	flagItem(args[0], args[2] || '');
} else {
	// Assume it's an item ID
	showItem(args[0]);
}
