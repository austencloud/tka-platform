#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const buildDir = path.resolve(__dirname, "../build");

// Strip all heavy static asset dirs — these are fetched from the web at runtime.
// Only _app (JS/CSS bundles), index.html, fonts, and pictographs are needed offline.
const strip = [
	"models", "guide", "store-assets", "thumbnails",
	"gallery", "images", "assets", "guides", "textures",
	"animations", "sounds", "data", "pwa", "branding",
	"retro-eras", "about", ".well-known",
];

let freed = 0;
for (const d of strip) {
	const p = path.join(buildDir, d);
	if (fs.existsSync(p)) {
		const stat = fs.statSync(p);
		if (stat.isDirectory()) {
			fs.rmSync(p, { recursive: true, force: true });
			console.log("Stripped", d);
			freed++;
		}
	}
}
console.log(`Stripped ${freed} directories. Remaining build for Tauri embedding.`);
