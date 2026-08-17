#!/usr/bin/env node
/**
 * Restore the current-revision static thumbnails into the desktop build.
 *
 * trim-deploy-assets.js deletes thumbnails/ from the Cloudflare output because
 * of Pages deploy limits — a web-only constraint the Tauri bundle inherited by
 * accident. Without the static tier, a fresh desktop install cold-misses every
 * thumbnail (cloud probes 404, the render queue stampedes into 15s timeouts)
 * and the library shows blank cards for minutes on first visit.
 *
 * Only the current THUMBNAIL_RENDERER_VERSION files ship: static/thumbnails/
 * also holds ~180 MB of stale-revision renders the orchestrator can never
 * serve, while the live slice is ~11 MB. The bundled manifest is filtered to
 * the copied keys so the static tier never claims a file that would fall
 * through to the index.html SPA fallback.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "static/thumbnails");
const buildDir = path.resolve(root, ".svelte-kit/cloudflare");
const targetDir = path.join(buildDir, "thumbnails");

const deriverSource = fs.readFileSync(
	path.join(root, "src/lib/shared/browse/services/thumbnail-key-deriver.ts"),
	"utf8"
);
const versionMatch = deriverSource.match(
	/THUMBNAIL_RENDERER_VERSION\s*=\s*(\d+)/
);
if (!versionMatch) {
	throw new Error(
		"Could not read THUMBNAIL_RENDERER_VERSION from thumbnail-key-deriver.ts"
	);
}
const rendererSuffix = `_r${versionMatch[1]}_`;

if (!fs.existsSync(buildDir)) {
	throw new Error(`Desktop web output not found: ${buildDir}`);
}
const manifestPath = path.join(sourceDir, "manifest.json");
if (!fs.existsSync(manifestPath)) {
	console.warn(
		"No static/thumbnails/manifest.json — skipping thumbnail bundling."
	);
	process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const allKeys = Array.isArray(manifest) ? manifest : manifest.keys;
const currentKeys = allKeys.filter((key) => key.includes(rendererSuffix));

let copied = 0;
let missing = 0;
let bytes = 0;
const bundledKeys = [];

for (const key of currentKeys) {
	const source = path.join(sourceDir, `${key}.webp`);
	if (!fs.existsSync(source)) {
		missing++;
		continue;
	}
	const target = path.join(targetDir, `${key}.webp`);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.copyFileSync(source, target);
	bytes += fs.statSync(source).size;
	bundledKeys.push(key);
	copied++;
}

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(
	path.join(targetDir, "manifest.json"),
	JSON.stringify({ keys: bundledKeys })
);

console.log(
	`Bundled ${copied} r${versionMatch[1]} static thumbnails (${(
		bytes /
		(1024 * 1024)
	).toFixed(1)} MB)` +
		(missing ? `; ${missing} manifest keys had no file and were dropped.` : ".")
);
