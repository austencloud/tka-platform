// Component inventory for the god-component-decomposition project (ceremony v2.0).
//
// Reads every .svelte component under src/ (excluding routes/test scratch pages)
// and computes the "disease-score" defined in
// docs/specs/god-component-decomposition.md:
//
//     diseaseScore = scriptLines + 4*$derived + 8*$effect + 3*functions
//
// $effect is weighted highest because it is the riskiest reactivity to relocate.
// The score is what the project gates on — NOT raw line count, which both
// over-flags cohesive CSS-heavy components and under-flags logic monsters that
// hide under 800 total lines.
//
// Output:
//   - scripts/component-manifest.json   full per-file data, sorted by diseaseScore
//   - console summary                   species counts, top offenders, keeper seed,
//                                       and "hidden monsters" (small total, high score)
//
// Pure analysis. Touches no application code. Re-runnable.

import { readdir, readFile, writeFile } from "fs/promises";
import { resolve, relative, join } from "path";

const SRC_ROOT = resolve("src");
const MANIFEST_PATH = resolve("scripts/component-manifest.json");

// ── Tunable thresholds ───────────────────────────────────────────────
// EXTRACT_SCORE captures roughly the worst ~22 logic monsters measured 2026-06-02
// (the 22nd scored 599). The lint gate (Phase 4) ratchets from here.
const EXTRACT_SCORE = 600;
const LEAN_SCRIPT = 350; // a style-dominant component with a script under this is a keeper
const BIG_TOTAL = 800; // the old (wrong) raw-line trigger, kept only for cross-checking

// Path fragments that mark a likely declarative 3D / scene-graph keeper.
const SCENE_PATH = /\/(3d|scenes|environments|procedural-engine|render-graph)\//;

// ── Helpers ──────────────────────────────────────────────────────────

async function walk(dir, acc) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (/node_modules|\.git/.test(p)) continue;
			await walk(p, acc);
		} else if (entry.name.endsWith(".svelte")) {
			acc.push(p);
		}
	}
	return acc;
}

function sumBlockLines(source, tag) {
	const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
	let total = 0;
	let m;
	while ((m = re.exec(source))) total += m[1].split("\n").length;
	return total;
}

function scriptBody(source) {
	const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
	let body = "";
	let m;
	while ((m = re.exec(source))) body += m[1] + "\n";
	return body;
}

function countMatches(str, re) {
	return (str.match(re) || []).length;
}

function classifySpecies(scriptLines, templateLines, styleLines) {
	const max = Math.max(scriptLines, templateLines, styleLines);
	if (max === scriptLines) return "logic";
	if (max === styleLines) return "style";
	return "template";
}

function recommend(file, species, diseaseScore, scriptLines, childCount, reactivity) {
	const isScenePath = SCENE_PATH.test(file);
	const declarative = reactivity <= 4 && childCount >= 4; // wiring/scene-graph, little logic
	if (isScenePath && declarative) {
		return { action: "keeper", reason: "declarative 3D / scene-graph (path + low reactivity)" };
	}
	if (species === "style" && scriptLines < LEAN_SCRIPT) {
		return { action: "keeper", reason: "presentational: CSS-dominant with a lean script" };
	}
	if (diseaseScore >= EXTRACT_SCORE) {
		if (species === "logic") {
			return { action: "extract-script", reason: "logic monster: lift state+helpers into *.svelte.ts" };
		}
		if (species === "template") {
			return { action: "split-template", reason: "layout shell: break markup into sub-children" };
		}
		return { action: "review", reason: "high score but style-dominant — inspect for hidden logic" };
	}
	return { action: "ok", reason: "below the disease-score gate" };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
	const files = (await walk(SRC_ROOT, [])).filter(
		(f) => !relative(SRC_ROOT, f).replace(/\\/g, "/").startsWith("routes/test/"),
	);

	const rows = [];
	for (const f of files) {
		const source = await readFile(f, "utf8");
		const total = source.split("\n").length;
		const scriptLines = sumBlockLines(source, "script");
		const styleLines = sumBlockLines(source, "style");
		const templateLines = Math.max(0, total - scriptLines - styleLines);
		const body = scriptBody(source);

		const stateCount = countMatches(body, /\$state\b/g);
		const derivedCount = countMatches(body, /\$derived\b/g);
		const effectCount = countMatches(body, /\$effect\b/g);
		const functionCount = countMatches(body, /\bfunction\s+\w+/g);
		const childComponents = new Set(
			(source.match(/<[A-Z][A-Za-z0-9]+/g) || []).map((t) => t.slice(1)),
		);

		const diseaseScore =
			scriptLines + 4 * derivedCount + 8 * effectCount + 3 * functionCount;
		const reactivity = stateCount + derivedCount + effectCount;
		const species = classifySpecies(scriptLines, templateLines, styleLines);
		const rel = relative(SRC_ROOT, f).replace(/\\/g, "/");
		const rec = recommend(rel, species, diseaseScore, scriptLines, childComponents.size, reactivity);

		rows.push({
			file: rel,
			total,
			scriptLines,
			templateLines,
			styleLines,
			stateCount,
			derivedCount,
			effectCount,
			functionCount,
			childComponents: childComponents.size,
			diseaseScore,
			species,
			action: rec.action,
			reason: rec.reason,
			hiddenMonster: total < BIG_TOTAL && diseaseScore >= EXTRACT_SCORE,
		});
	}

	rows.sort((a, b) => b.diseaseScore - a.diseaseScore);

	const summary = {
		generatedAt: new Date().toISOString(),
		thresholds: { EXTRACT_SCORE, LEAN_SCRIPT, BIG_TOTAL },
		totalComponents: rows.length,
		bySpecies: tally(rows, "species"),
		byAction: tally(rows, "action"),
		extractCandidates: rows.filter((r) => r.action === "extract-script").length,
		splitCandidates: rows.filter((r) => r.action === "split-template").length,
		keepers: rows.filter((r) => r.action === "keeper").length,
		hiddenMonsters: rows.filter((r) => r.hiddenMonster).map((r) => r.file),
		// cross-check against the manual 2026-06-02 measurement over total>800
		over800: speciesBreakdown(rows.filter((r) => r.total > BIG_TOTAL)),
	};

	await writeFile(MANIFEST_PATH, JSON.stringify({ summary, components: rows }, null, 2));

	// ── Console report ───────────────────────────────────────────────
	console.log("\n=== Component inventory (god-component-decomposition / ceremony v2.0) ===\n");
	console.log(`Components scanned (excl. routes/test): ${rows.length}`);
	console.log(`By species:`, summary.bySpecies);
	console.log(`By recommended action:`, summary.byAction);
	console.log(`\nCross-check — species among files over ${BIG_TOTAL} total lines:`);
	console.log("  ", summary.over800);
	console.log(`\nTop 25 by disease-score (the real targets):`);
	console.log("  score  tot  scr  d  e  fn  action          file");
	for (const r of rows.slice(0, 25)) {
		console.log(
			"  " +
				String(r.diseaseScore).padStart(5) +
				String(r.total).padStart(5) +
				String(r.scriptLines).padStart(5) +
				String(r.derivedCount).padStart(3) +
				String(r.effectCount).padStart(3) +
				String(r.functionCount).padStart(4) +
				"  " +
				r.action.padEnd(15) +
				" " +
				r.file,
		);
	}
	const hidden = rows.filter((r) => r.hiddenMonster);
	if (hidden.length) {
		console.log(`\nHidden monsters (under ${BIG_TOTAL} total lines but score >= ${EXTRACT_SCORE}):`);
		for (const r of hidden) console.log(`  ${String(r.diseaseScore).padStart(5)}  ${r.file}`);
	}
	console.log(`\nManifest written: ${relative(process.cwd(), MANIFEST_PATH)}`);
}

function tally(rows, key) {
	const out = {};
	for (const r of rows) out[r[key]] = (out[r[key]] || 0) + 1;
	return out;
}

function speciesBreakdown(rows) {
	const out = { count: rows.length };
	for (const r of rows) out[r.species] = (out[r.species] || 0) + 1;
	return out;
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
