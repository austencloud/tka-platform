#!/usr/bin/env node

/**
 * Track search interest for "The Kinetic Alphabet" and related terms.
 *
 * Uses SerpApi (free tier: 100 searches/month) to pull Google Trends data
 * and logs results to a local JSON file for historical tracking.
 *
 * Setup:
 *   1. Sign up at https://serpapi.com (free account = 100 searches/month)
 *   2. Set env var: SERPAPI_KEY=your_key_here (or add to .env)
 *   3. Run: node scripts/track-search-interest.js
 *
 * Outputs to: data/search-interest.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const OUTPUT_FILE = path.join(DATA_DIR, "search-interest.json");

const SERPAPI_KEY = process.env.SERPAPI_KEY;

const TRACKED_TERMS = [
	"the kinetic alphabet",
	"kinetic alphabet",
	"flow arts notation",
	"poi notation",
	"staff spinning notation",
];

async function fetchGoogleTrends(keyword) {
	const params = new URLSearchParams({
		engine: "google_trends",
		q: keyword,
		data_type: "TIMESERIES",
		date: "today 12-m", // last 12 months
		api_key: SERPAPI_KEY,
	});

	const url = `https://serpapi.com/search.json?${params}`;
	const res = await fetch(url);

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`SerpApi error (${res.status}): ${text}`);
	}

	return res.json();
}

async function fetchSearchVolume(keyword) {
	const params = new URLSearchParams({
		engine: "google_trends",
		q: keyword,
		data_type: "RELATED_QUERIES",
		date: "today 12-m",
		api_key: SERPAPI_KEY,
	});

	const url = `https://serpapi.com/search.json?${params}`;
	const res = await fetch(url);

	if (!res.ok) return null;

	return res.json();
}

function loadExistingData() {
	if (fs.existsSync(OUTPUT_FILE)) {
		return JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
	}
	return { snapshots: [], metadata: { created: new Date().toISOString() } };
}

function saveData(data) {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
	data.metadata.lastUpdated = new Date().toISOString();
	data.metadata.snapshotCount = data.snapshots.length;
	fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
}

async function main() {
	if (!SERPAPI_KEY) {
		console.error(
			"\n  Missing SERPAPI_KEY environment variable.\n" +
				"  Sign up at https://serpapi.com (free: 100 searches/month)\n" +
				"  Then: set SERPAPI_KEY=your_key_here\n"
		);
		process.exit(1);
	}

	console.log(`Tracking search interest — ${new Date().toLocaleDateString()}\n`);

	const data = loadExistingData();
	const snapshot = {
		date: new Date().toISOString(),
		terms: {},
	};

	for (const term of TRACKED_TERMS) {
		process.stdout.write(`  "${term}" ...`);

		try {
			const trends = await fetchGoogleTrends(term);
			const timeline = trends.interest_over_time?.timeline_data || [];

			// Extract the most recent data points
			const recentPoints = timeline.slice(-4).map((point) => ({
				date: point.date,
				value: point.values?.[0]?.extracted_value ?? 0,
			}));

			// Current interest (most recent point)
			const currentValue = recentPoints.at(-1)?.value ?? 0;

			// Average over last 4 weeks
			const avg =
				recentPoints.length > 0
					? Math.round(
							recentPoints.reduce((sum, p) => sum + p.value, 0) /
								recentPoints.length
						)
					: 0;

			snapshot.terms[term] = {
				current: currentValue,
				fourWeekAvg: avg,
				recentPoints,
				dataPoints: timeline.length,
			};

			console.log(` current=${currentValue}, 4wk avg=${avg}`);
		} catch (err) {
			snapshot.terms[term] = { error: err.message };
			console.log(` ERROR: ${err.message}`);
		}
	}

	// Fetch related queries for the primary term (uses 1 extra API call)
	try {
		process.stdout.write(`  Related queries ...`);
		const related = await fetchSearchVolume(TRACKED_TERMS[0]);
		const risingQueries =
			related?.related_queries?.rising?.map((q) => ({
				query: q.query,
				value: q.extracted_value,
			})) || [];

		snapshot.relatedQueries = risingQueries.slice(0, 10);
		console.log(` ${risingQueries.length} rising queries found`);
	} catch {
		console.log(` (skipped)`);
	}

	data.snapshots.push(snapshot);
	saveData(data);

	console.log(`\nSaved to ${OUTPUT_FILE}`);
	console.log(`Total snapshots: ${data.snapshots.length}`);

	// Show trend direction if we have history
	if (data.snapshots.length >= 2) {
		const prev = data.snapshots.at(-2);
		const primaryTerm = TRACKED_TERMS[0];
		const prevVal = prev.terms[primaryTerm]?.fourWeekAvg ?? 0;
		const currVal = snapshot.terms[primaryTerm]?.fourWeekAvg ?? 0;

		if (prevVal > 0) {
			const pctChange = Math.round(((currVal - prevVal) / prevVal) * 100);
			const arrow = pctChange > 0 ? "^" : pctChange < 0 ? "v" : "=";
			console.log(
				`\nTrend for "${primaryTerm}": ${prevVal} -> ${currVal} (${arrow} ${pctChange}%)`
			);
		}
	}
}

main().catch((err) => {
	console.error("Fatal:", err.message);
	process.exit(1);
});
