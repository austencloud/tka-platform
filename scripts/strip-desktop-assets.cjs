#!/usr/bin/env node
/**
 * Remove web-only and streamed assets before Tauri embeds the frontend.
 * The Cloudflare adapter output is also the native static app shell, but the
 * desktop binary does not need Cloudflare worker files or multi-gigabyte media.
 */
const fs = require("node:fs");
const path = require("node:path");

const buildDir = path.resolve(__dirname, "../.svelte-kit/cloudflare");
const requiredPaths = ["_app", "index.html"];

if (!fs.existsSync(buildDir)) {
	throw new Error(`Desktop web output not found: ${buildDir}`);
}

for (const requiredPath of requiredPaths) {
	if (!fs.existsSync(path.join(buildDir, requiredPath))) {
		throw new Error(
			`Refusing to strip incomplete desktop output: missing ${requiredPath}`
		);
	}
}

const keepDirs = new Set([
	"_app",
	"fonts",
	"images",
	"data",
	"notation",
	"pictographs",
]);

const imageKeep = new Set([
	"props",
	"grid",
	"arrows",
	"numbers",
	"position_images",
	"vtg_glyphs",
	"scene-thumbs",
]);

const dataKeep = new Set(["pictographs", "arrow_placement", "learn"]);
const cloudflareFiles = new Set([
	"_headers",
	"_redirects",
	"_routes.json",
	"_worker.js",
]);

let stripped = 0;

for (const entry of fs.readdirSync(buildDir, { withFileTypes: true })) {
	if (entry.isDirectory() && !keepDirs.has(entry.name)) {
		fs.rmSync(path.join(buildDir, entry.name), {
			recursive: true,
			force: true,
		});
		console.log(`  Stripped ${entry.name}/`);
		stripped++;
	} else if (entry.isFile() && cloudflareFiles.has(entry.name)) {
		fs.rmSync(path.join(buildDir, entry.name), { force: true });
		console.log(`  Stripped ${entry.name}`);
		stripped++;
	}
}

const imagesDir = path.join(buildDir, "images");
if (fs.existsSync(imagesDir)) {
	const rootImageKeep = new Set([
		"arrows-sprite.svg",
		"_arrows-sprite.svg",
		"arrow.svg",
		"blank.svg",
		"dash.svg",
		"same_opp_dot.svg",
	]);

	for (const entry of fs.readdirSync(imagesDir, { withFileTypes: true })) {
		if (entry.isDirectory() && !imageKeep.has(entry.name)) {
			fs.rmSync(path.join(imagesDir, entry.name), {
				recursive: true,
				force: true,
			});
			console.log(`  Stripped images/${entry.name}/`);
			stripped++;
		} else if (entry.isFile() && !rootImageKeep.has(entry.name)) {
			fs.rmSync(path.join(imagesDir, entry.name), { force: true });
			stripped++;
		}
	}
}

const dataDir = path.join(buildDir, "data");
if (fs.existsSync(dataDir)) {
	for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
		if (entry.isDirectory() && !dataKeep.has(entry.name)) {
			fs.rmSync(path.join(dataDir, entry.name), {
				recursive: true,
				force: true,
			});
			console.log(`  Stripped data/${entry.name}/`);
			stripped++;
		}
	}
}

let totalSize = 0;
let totalFiles = 0;
const directories = [buildDir];

while (directories.length > 0) {
	const directory = directories.pop();
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const absolutePath = path.join(directory, entry.name);
		if (entry.isDirectory()) directories.push(absolutePath);
		else {
			totalSize += fs.statSync(absolutePath).size;
			totalFiles++;
		}
	}
}

console.log(
	`Stripped ${stripped} desktop asset groups. Remaining: ${totalFiles} files (${(
		totalSize /
		(1024 * 1024)
	).toFixed(1)} MB).`
);
