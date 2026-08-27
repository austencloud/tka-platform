/**
 * Download all soundscape candidate audio files to static/audio/soundscapes/.
 *
 * For generated candidates (from search-soundscapes.cjs), the preview URL is
 * known. For curated entries, we look up the preview URL via the Freesound
 * API using the stored freesoundId.
 *
 * Idempotent: skips files that already exist unless --force is passed.
 *
 * Usage:
 *   node scripts/fetch-soundscapes.cjs             # all wings
 *   node scripts/fetch-soundscapes.cjs --wing fear # one wing only
 *   node scripts/fetch-soundscapes.cjs --force     # re-download even if exists
 */

"use strict";

const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");

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

const argv = process.argv.slice(2);
const wingFlag = argv.indexOf("--wing");
const ONLY_WING = wingFlag >= 0 ? argv[wingFlag + 1] : null;
const FORCE = argv.includes("--force");
const CONCURRENCY = 4;

const ROOT = path.join(__dirname, "..");
const AUDIO_DIR = path.join(ROOT, "static", "audio", "soundscapes");
const GENERATED_JSON = path.join(ROOT, "src", "lib", "features", "museum", "audio", "soundscape-candidates.generated.json");
const CURATED_MANIFEST = path.join(ROOT, "src", "lib", "features", "museum", "audio", "soundscape-manifest.ts");

async function readGenerated() {
	try {
		const text = await fs.readFile(GENERATED_JSON, "utf8");
		return JSON.parse(text).wings || [];
	} catch {
		return [];
	}
}

// character-by-character, tracking brace/bracket depth. A regex-based parser
// crosses wing boundaries because TypeScript string literals and nested object
// literals confuse lazy matchers. This depth-walker is robust for the shapes
// the manifest actually contains.
async function readCurated() {
	const text = await fs.readFile(CURATED_MANIFEST, "utf8");
	const arrayStart = text.indexOf("CURATED_WING_SOUNDSCAPES");
	if (arrayStart < 0) return [];
	// Skip past the `WingSoundscape[]` type annotation and find the real
	// array literal that starts after `=`.
	const eqIdx = text.indexOf("=", arrayStart);
	if (eqIdx < 0) return [];
	const openBracket = text.indexOf("[", eqIdx);
	if (openBracket < 0) return [];

	const wings = [];
	let i = openBracket + 1;
	while (i < text.length) {
		// Skip whitespace and commas
		while (i < text.length && /[\s,]/.test(text[i])) i++;
		if (text[i] === "]") break; // end of top-level array
		if (text[i] !== "{") { i++; continue; }

		// Found a wing object — walk matching braces
		const objStart = i;
		let depth = 0;
		let inStr = false;
		let strCh = "";
		for (; i < text.length; i++) {
			const ch = text[i];
			if (inStr) {
				if (ch === "\\") { i++; continue; }
				if (ch === strCh) inStr = false;
				continue;
			}
			if (ch === '"' || ch === "'") { inStr = true; strCh = ch; continue; }
			if (ch === "{") depth++;
			else if (ch === "}") { depth--; if (depth === 0) { i++; break; } }
		}
		const objText = text.slice(objStart, i);

		const wingIdMatch = objText.match(/wingId:\s*"([^"]+)"/);
		if (!wingIdMatch) continue;
		const wingId = wingIdMatch[1];

		// Extract candidate entries inside the top-level candidates: [...]
		const candOpenIdx = objText.indexOf("candidates:");
		if (candOpenIdx < 0) continue;
		const bracketIdx = objText.indexOf("[", candOpenIdx);
		if (bracketIdx < 0) continue;
		const candidates = [];
		let j = bracketIdx + 1;
		while (j < objText.length) {
			while (j < objText.length && /[\s,]/.test(objText[j])) j++;
			if (objText[j] === "]") break;
			if (objText[j] !== "{") { j++; continue; }
			const candStart = j;
			let cd = 0;
			let cs = false;
			let ccCh = "";
			for (; j < objText.length; j++) {
				const ch = objText[j];
				if (cs) {
					if (ch === "\\") { j++; continue; }
					if (ch === ccCh) cs = false;
					continue;
				}
				if (ch === '"' || ch === "'") { cs = true; ccCh = ch; continue; }
				if (ch === "{") cd++;
				else if (ch === "}") { cd--; if (cd === 0) { j++; break; } }
			}
			const candText = objText.slice(candStart, j);
			const idM = candText.match(/\bid:\s*"([^"]*)"/);
			const fileM = candText.match(/\bfile:\s*"([^"]*)"/);
			const fsIdM = candText.match(/\bfreesoundId:\s*(\d+)/);
			if (idM && fileM) {
				candidates.push({
					id: idM[1],
					file: fileM[1],
					freesoundId: fsIdM ? parseInt(fsIdM[1], 10) : undefined,
				});
			}
		}
		if (candidates.length > 0) wings.push({ wingId, candidates });
	}
	return wings;
}

async function resolvePreviewUrl(cand) {
	if (cand.previewUrl) return cand.previewUrl;
	if (!cand.freesoundId) return null;
	if (!API_KEY) {
		console.warn(`  missing FREESOUND_API_KEY — cannot resolve ${cand.id}`);
		return null;
	}
	const url = `https://freesound.org/apiv2/sounds/${cand.freesoundId}/?fields=previews&token=${API_KEY}`;
	const res = await fetch(url);
	if (!res.ok) {
		console.warn(`  Freesound lookup failed for ${cand.freesoundId}: HTTP ${res.status}`);
		return null;
	}
	const data = await res.json();
	return data.previews?.["preview-hq-mp3"] ?? data.previews?.["preview-lq-mp3"] ?? null;
}

async function downloadOne(wingId, cand) {
	const dir = path.join(AUDIO_DIR, wingId);
	await fs.mkdir(dir, { recursive: true });
	const outPath = path.join(dir, cand.file);

	if (!FORCE) {
		try {
			const stat = await fs.stat(outPath);
			if (stat.size > 1024) return { status: "exists", outPath };
		} catch {
			/* fall through to download */
		}
	}

	const previewUrl = await resolvePreviewUrl(cand);
	if (!previewUrl) return { status: "no-url" };

	const res = await fetch(previewUrl);
	if (!res.ok) return { status: "fail", code: res.status };

	await pipeline(Readable.fromWeb(res.body), fsSync.createWriteStream(outPath));
	return { status: "ok", outPath, bytes: Number(res.headers.get("content-length") || 0) };
}

async function runPool(tasks, concurrency) {
	const results = [];
	let index = 0;
	async function worker() {
		while (index < tasks.length) {
			const i = index++;
			const { wingId, cand } = tasks[i];
			try {
				const result = await downloadOne(wingId, cand);
				results.push({ wingId, cand, ...result });
				const tag = result.status === "ok" ? "✓" : result.status === "exists" ? "·" : "✗";
				console.log(`  ${tag} ${wingId}/${cand.file}`);
			} catch (err) {
				results.push({ wingId, cand, status: "error", error: err.message });
				console.log(`  ✗ ${wingId}/${cand.file} — ${err.message}`);
			}
		}
	}
	await Promise.all(Array.from({ length: concurrency }, worker));
	return results;
}

async function main() {
	const [curated, generated] = await Promise.all([readCurated(), readGenerated()]);

	// Merge by wingId, dedup candidate id.
	const byWing = new Map();
	for (const w of curated) {
		byWing.set(w.wingId, [...w.candidates]);
	}
	for (const w of generated) {
		const existing = byWing.get(w.wingId) ?? [];
		const seen = new Set(existing.map((c) => c.id));
		for (const c of w.candidates) {
			if (!seen.has(c.id)) existing.push(c);
		}
		byWing.set(w.wingId, existing);
	}

	if (ONLY_WING && !byWing.has(ONLY_WING)) {
		console.error(`Unknown wing: ${ONLY_WING}`);
		process.exit(1);
	}

	const tasks = [];
	for (const [wingId, cands] of byWing) {
		if (ONLY_WING && wingId !== ONLY_WING) continue;
		for (const cand of cands) {
			tasks.push({ wingId, cand });
		}
	}

	console.log(`Downloading ${tasks.length} candidate(s) into ${path.relative(ROOT, AUDIO_DIR)}...`);
	const results = await runPool(tasks, CONCURRENCY);

	const ok = results.filter((r) => r.status === "ok").length;
	const exists = results.filter((r) => r.status === "exists").length;
	const fail = results.filter((r) => r.status !== "ok" && r.status !== "exists").length;
	console.log(`\n${ok} downloaded, ${exists} already present, ${fail} failed.`);

	// Cleanup: remove any files on disk that are no longer referenced in the
	// merged manifest (curated + generated). Keeps the directory in sync with
	// what the UI will actually show. Skipped if a single-wing filter is set.
	if (!ONLY_WING) {
		const referenced = new Set();
		for (const [wingId, cands] of byWing) {
			for (const c of cands) {
				referenced.add(path.join(wingId, c.file));
			}
		}
		let removed = 0;
		for (const [wingId] of byWing) {
			const dir = path.join(AUDIO_DIR, wingId);
			let entries;
			try {
				entries = await fs.readdir(dir);
			} catch {
				continue;
			}
			for (const name of entries) {
				const rel = path.join(wingId, name);
				if (!referenced.has(rel)) {
					await fs.unlink(path.join(dir, name));
					removed++;
					console.log(`  removed orphan ${rel}`);
				}
			}
		}
		if (removed > 0) console.log(`\nCleaned ${removed} orphaned file(s).`);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
