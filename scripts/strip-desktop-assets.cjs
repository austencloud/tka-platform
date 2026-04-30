#!/usr/bin/env node
/**
 * Strip heavy static assets from build/ for the Tauri desktop bundle.
 * Runs after `pnpm build` in the Tauri beforeBuildCommand.
 *
 * Keep: _app/ (JS/CSS), fonts/, essential images (props, grid, arrows),
 *       essential data (pictographs, arrow_placement), root files.
 * Strip: everything else (models, gallery, thumbnails, etc.)
 */
const fs = require("fs");
const path = require("path");

const buildDir = path.resolve(__dirname, "../build");

// Top-level dirs to KEEP in the desktop build
const keepDirs = new Set([
	"_app",        // JS/CSS bundles — the app itself
	"fonts",       // Font files
	"images",      // Partially kept (sub-stripped below)
	"data",        // Partially kept (sub-stripped below)
	"notation",    // Small
	"pictographs", // Small
]);

// Strip all top-level dirs NOT in keepDirs
const topLevelDirs = fs.readdirSync(buildDir, { withFileTypes: true })
	.filter(d => d.isDirectory())
	.map(d => d.name);

let stripped = 0;
for (const d of topLevelDirs) {
	if (!keepDirs.has(d)) {
		const p = path.join(buildDir, d);
		fs.rmSync(p, { recursive: true, force: true });
		console.log(`  Stripped ${d}/`);
		stripped++;
	}
}

// Sub-strip within images/ — keep only props, grid, arrows, numbers, etc.
const imageKeep = new Set([
	"props", "grid", "arrows", "numbers", "position_images",
	"vtg_glyphs", "scene-thumbs",
]);
const imagesDir = path.join(buildDir, "images");
if (fs.existsSync(imagesDir)) {
	for (const entry of fs.readdirSync(imagesDir, { withFileTypes: true })) {
		if (entry.isDirectory() && !imageKeep.has(entry.name)) {
			fs.rmSync(path.join(imagesDir, entry.name), { recursive: true, force: true });
			console.log(`  Stripped images/${entry.name}/`);
			stripped++;
		}
		if (entry.isFile()) {
			const keep = ["arrows-sprite.svg", "_arrows-sprite.svg", "arrow.svg",
				"blank.svg", "dash.svg", "same_opp_dot.svg"];
			if (!keep.includes(entry.name)) {
				fs.rmSync(path.join(imagesDir, entry.name), { force: true });
				stripped++;
			}
		}
	}
}

// Sub-strip within data/ — keep pictographs, arrow_placement, learn
const dataKeep = new Set(["pictographs", "arrow_placement", "learn"]);
const dataDir = path.join(buildDir, "data");
if (fs.existsSync(dataDir)) {
	for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
		if (entry.isDirectory() && !dataKeep.has(entry.name)) {
			fs.rmSync(path.join(dataDir, entry.name), { recursive: true, force: true });
			console.log(`  Stripped data/${entry.name}/`);
			stripped++;
		}
	}
}

// Report final size
let totalSize = 0;
let totalFiles = 0;
function walk(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(p);
		else { totalSize += fs.statSync(p).size; totalFiles++; }
	}
}
walk(buildDir);
const mb = (totalSize / (1024 * 1024)).toFixed(1);
console.log(`\nStripped ${stripped} items. Remaining: ${totalFiles} files (${mb}MB).`);
