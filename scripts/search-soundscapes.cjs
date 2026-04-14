/**
 * Query Freesound (and optionally Pixabay) for ambient candidates per
 * museum wing. Writes src/lib/features/museum/audio/soundscape-candidates.generated.ts.
 *
 * Requires FREESOUND_API_KEY in .env. PIXABAY_API_KEY is optional (currently
 * unused — Freesound covers all 16 wings; Pixabay hook is reserved for future
 * muzak/music searches).
 *
 * Usage:
 *   node scripts/search-soundscapes.cjs            # 4 candidates per wing
 *   node scripts/search-soundscapes.cjs --per 6    # 6 per wing
 *   node scripts/search-soundscapes.cjs --wing fear   # only one wing
 */

"use strict";

const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");

loadDotEnv(path.join(__dirname, "..", ".env"));

function loadDotEnv(file) {
	if (!fsSync.existsSync(file)) return;
	const text = fsSync.readFileSync(file, "utf8");
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq < 0) continue;
		const key = line.slice(0, eq).trim();
		let val = line.slice(eq + 1).trim();
		if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
			val = val.slice(1, -1);
		}
		if (!(key in process.env)) process.env[key] = val;
	}
}

const API_KEY = process.env.FREESOUND_API_KEY;
if (!API_KEY) {
	console.error("Missing FREESOUND_API_KEY in .env — get one at https://freesound.org/apiv2/apply/");
	process.exit(1);
}

// Per-wing search strategies. We target MUSIC, not pure SFX — each query is
// written to surface musical content (loops, pads, melodies, scores). The
// post-filter (isMusical) rejects hits whose tags don't include any musical
// keyword, which keeps ambient-SFX noise out of the pool.
const WING_STRATEGIES = [
	{
		wingId: "entrance",
		queries: ["museum ambient music", "orchestral ambient", "cinematic score quiet", "hall music ambient"],
		minDuration: 30,
		defaultVolume: 0.3,
	},
	{
		wingId: "vulcan-cave",
		queries: ["cave ambient music", "underground music mystical", "dark cavern music", "cave drone music"],
		minDuration: 30,
		defaultVolume: 0.5,
	},
	{
		wingId: "egyptian",
		queries: ["egyptian music", "middle eastern ambient", "oud instrumental", "arabic ambient music"],
		minDuration: 30,
		defaultVolume: 0.35,
	},
	{
		wingId: "renaissance",
		queries: ["lute medieval", "harpsichord music", "renaissance music flute", "baroque instrumental"],
		minDuration: 20,
		defaultVolume: 0.3,
	},
	{
		wingId: "victorian",
		queries: ["victorian piano", "steampunk music", "waltz music box", "gothic piano"],
		minDuration: 30,
		defaultVolume: 0.35,
	},
	{
		wingId: "digital",
		queries: ["chiptune ambient", "synthwave", "vaporwave", "8bit music loop"],
		minDuration: 15,
		defaultVolume: 0.3,
	},
	{
		wingId: "suppression",
		queries: ["hold music instrumental", "corporate muzak", "dystopian ambient music", "office jazz loop"],
		minDuration: 15,
		defaultVolume: 0.4,
	},
	{
		wingId: "crumble",
		queries: ["haunted piano", "eerie ambient music", "abandoned piano", "broken music box"],
		minDuration: 30,
		defaultVolume: 0.4,
	},
	{
		wingId: "gallery",
		queries: ["ambient piano loop", "music box", "warm piano melody", "soft instrumental"],
		minDuration: 15,
		defaultVolume: 0.25,
	},
	{
		wingId: "fear",
		queries: ["dark ambient drone", "horror score ambient", "tension drone music", "sub bass drone"],
		minDuration: 60,
		defaultVolume: 0.45,
	},
	{
		wingId: "isolation",
		queries: ["minimalist ambient music", "drone pad", "soft ambient music", "deep pad"],
		minDuration: 30,
		defaultVolume: 0.25,
	},
	{
		wingId: "collaboration",
		queries: ["uplifting ambient", "warm pad music", "world music ambient", "hopeful ambient"],
		minDuration: 20,
		defaultVolume: 0.4,
	},
	{
		wingId: "gift-shop",
		queries: ["elevator music instrumental", "muzak loop", "supermarket music", "easy listening loop"],
		minDuration: 30,
		defaultVolume: 0.3,
	},
	{
		wingId: "vtg-wing",
		queries: ["sparse piano ambient", "minimal piano", "lonely piano music", "distant piano"],
		minDuration: 30,
		defaultVolume: 0.25,
	},
	{
		wingId: "construction-zone",
		queries: ["industrial ambient music", "metal drone music", "factory music ambient", "industrial pad"],
		minDuration: 30,
		defaultVolume: 0.3,
	},
	{
		wingId: "janitor",
		queries: ["quiet piano solo", "intimate piano ambient", "lonely piano music", "sad solo piano"],
		minDuration: 30,
		defaultVolume: 0.2,
	},
];

// A hit's tags must include at least one of these (case-insensitive) or it is
// rejected. This filters out the pure-SFX noise that keyword queries still
// return on Freesound (e.g. searching "piano" sometimes returns "piano
// FALLING DOWN STAIRS.wav").
const MUSICAL_TAG_PATTERNS = [
	/^music$/i, /^musical$/i, /ambient/i, /piano/i, /synth/i, /drone/i,
	/\bpad\b/i, /melody/i, /harmony/i, /orchestr/i, /strings?/i, /violin/i,
	/cello/i, /guitar/i, /lute/i, /flute/i, /harp(?!y)/i, /harpsichord/i,
	/^loop$/i, /score/i, /soundtrack/i, /chiptune/i, /synthwave/i, /vaporwave/i,
	/muzak/i, /cinematic/i, /medieval/i, /renaissance/i, /baroque/i,
	/waltz/i, /symphon/i, /instrument/i, /keys?/i, /keyboard/i,
	/8.?bit/i, /8bit/i, /chillout/i, /lofi/i, /jazz/i, /classical/i,
	/electronic(?!a)/i, /electronica/i, /composition/i, /soundscape/i,
];

function isMusical(tags) {
	if (!tags || tags.length === 0) return false;
	return tags.some((t) => MUSICAL_TAG_PATTERNS.some((re) => re.test(t)));
}

const argv = process.argv.slice(2);
const perFlag = argv.indexOf("--per");
const PER_WING = perFlag >= 0 ? parseInt(argv[perFlag + 1], 10) : 4;
const wingFlag = argv.indexOf("--wing");
const ONLY_WING = wingFlag >= 0 ? argv[wingFlag + 1] : null;

// Freesound license filter — accept CC0 and CC-BY 4.0 (not Sampling+).
const LICENSE_FILTER = 'license:("Creative Commons 0" OR "Attribution")';

function formatDuration(seconds) {
	const m = Math.floor(seconds / 60);
	const s = Math.round(seconds % 60).toString().padStart(2, "0");
	return `${m}:${s}`;
}

function slugify(s) {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
}

function mapLicense(licenseUrl) {
	if (!licenseUrl) return null;
	if (licenseUrl.includes("publicdomain") || licenseUrl.includes("zero")) return "CC0";
	if (licenseUrl.includes("by/4.0") || licenseUrl.includes("/by/")) return "CC-BY-4.0";
	return null; // reject anything else (NC, SA, old by/3.0 etc.)
}

async function freesoundSearch(query, minDuration) {
	const params = new URLSearchParams({
		query,
		filter: `duration:[${minDuration} TO *] ${LICENSE_FILTER}`,
		fields: "id,name,username,license,duration,previews,tags,description",
		sort: "rating_desc",
		page_size: "15",
		token: API_KEY,
	});
	const url = `https://freesound.org/apiv2/search/text/?${params}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Freesound ${res.status}: ${await res.text()}`);
	}
	const data = await res.json();
	return data.results || [];
}

function candidateFromHit(wingId, hit, defaultVolume) {
	const license = mapLicense(hit.license);
	if (!license) return null;
	// preview-hq-mp3 is the redistributable ogg/mp3 preview. We use it both for
	// the source-of-truth URL and for what the downloader fetches.
	const previewUrl = hit.previews?.["preview-hq-mp3"] ?? hit.previews?.["preview-lq-mp3"];
	if (!previewUrl) return null;

	const slug = slugify(hit.name) || `freesound-${hit.id}`;
	const id = `${wingId}-fs-${hit.id}-${slug}`.slice(0, 80);

	return {
		id,
		title: hit.name,
		file: `${id}.mp3`,
		sourceUrl: `https://freesound.org/s/${hit.id}/`,
		previewUrl,
		attribution: `${hit.username} (Freesound)`,
		license,
		duration: formatDuration(hit.duration),
		volume: defaultVolume,
		source: "freesound",
		freesoundId: hit.id,
		notes: hit.tags?.slice(0, 4).join(", ") || undefined,
	};
}

async function gatherForWing(strat, curatedIds) {
	const seen = new Set(curatedIds);
	const collected = [];

	for (const query of strat.queries) {
		if (collected.length >= PER_WING) break;
		try {
			const hits = await freesoundSearch(query, strat.minDuration);
			for (const hit of hits) {
				if (collected.length >= PER_WING) break;
				if (seen.has(hit.id)) continue;
				if (!isMusical(hit.tags)) continue;
				const cand = candidateFromHit(strat.wingId, hit, strat.defaultVolume);
				if (!cand) continue;
				seen.add(hit.id);
				collected.push(cand);
			}
		} catch (err) {
			console.warn(`  [${strat.wingId}] query "${query}" failed: ${err.message}`);
		}
	}

	return collected;
}

async function loadCuratedIds() {
	// Parse curated manifest for freesoundId values so we don't duplicate them.
	const manifestPath = path.join(
		__dirname,
		"..",
		"src",
		"lib",
		"features",
		"museum",
		"audio",
		"soundscape-manifest.ts",
	);
	const text = await fs.readFile(manifestPath, "utf8");
	const ids = new Set();
	for (const match of text.matchAll(/freesoundId:\s*(\d+)/g)) {
		ids.add(parseInt(match[1], 10));
	}
	return ids;
}

async function main() {
	console.log(`Searching Freesound for candidates — ${PER_WING} per wing...`);
	const curatedIds = await loadCuratedIds();
	console.log(`  (skipping ${curatedIds.size} curated freesound IDs)`);

	const targets = ONLY_WING
		? WING_STRATEGIES.filter((s) => s.wingId === ONLY_WING)
		: WING_STRATEGIES;

	if (ONLY_WING && targets.length === 0) {
		console.error(`Unknown wing: ${ONLY_WING}`);
		process.exit(1);
	}

	const results = [];
	let totalQueries = 0;

	for (const strat of targets) {
		process.stdout.write(`  ${strat.wingId}... `);
		const candidates = await gatherForWing(strat, curatedIds);
		totalQueries += strat.queries.length;
		console.log(`${candidates.length} candidate(s)`);
		if (candidates.length > 0) {
			results.push({ wingId: strat.wingId, candidates });
		}
	}

	await writeGenerated(results, totalQueries);
	console.log(`\nWrote ${results.length} wings — ${results.reduce((n, r) => n + r.candidates.length, 0)} total candidates.`);
	console.log("Next: node scripts/fetch-soundscapes.cjs  (downloads the preview files)");
}

async function writeGenerated(results, totalQueries) {
	const outPath = path.join(
		__dirname,
		"..",
		"src",
		"lib",
		"features",
		"museum",
		"audio",
		"soundscape-candidates.generated.ts",
	);

	const header = `/**
 * AUTO-GENERATED — do not edit by hand.
 *
 * Produced by \`node scripts/search-soundscapes.cjs\`. Each run overwrites
 * this file with fresh candidates from the Freesound API (and Pixabay when
 * configured). The \`previewUrl\` field is used by the downloader script;
 * the \`sourceUrl\` points to the Freesound page for attribution.
 */

import type { WingSoundscape } from "./soundscape-manifest";

type GeneratedCandidate = WingSoundscape["candidates"][number] & { previewUrl: string };
type GeneratedWing = Pick<WingSoundscape, "wingId"> & { candidates: GeneratedCandidate[] };

export const GENERATED_WING_CANDIDATES: GeneratedWing[] = ${JSON.stringify(results, null, 2)};

export const GENERATION_METADATA = {
	generatedAt: ${JSON.stringify(new Date().toISOString())},
	freesoundQueries: ${totalQueries},
	pixabayQueries: 0,
};
`;

	await fs.writeFile(outPath, header);

	// Sidecar JSON so the downloader doesn't need to parse TypeScript.
	const jsonPath = path.join(
		__dirname,
		"..",
		"src",
		"lib",
		"features",
		"museum",
		"audio",
		"soundscape-candidates.generated.json",
	);
	await fs.writeFile(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), wings: results }, null, 2));
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
