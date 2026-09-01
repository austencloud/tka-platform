#!/usr/bin/env node
const { execFileSync, execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const strip = path.resolve(__dirname, "strip-desktop-assets.cjs");
const bundleThumbnails = path.resolve(
	__dirname,
	"bundle-desktop-thumbnails.cjs"
);
const generateEnv = path.resolve(__dirname, "generate-native-env.mjs");
const verifySurface = path.resolve(
	__dirname,
	"verify-native-release-surface.mjs"
);
const verifySequenceBundle = path.resolve(
	__dirname,
	"verify-desktop-sequence-bundle.mjs"
);
const buildDir = path.resolve(root, ".svelte-kit/cloudflare");

// Fail before the expensive frontend build when Tauri has no complete offline
// resource bundle to package. CI creates this bundle in a separate job.
execFileSync(process.execPath, [verifySequenceBundle], {
	cwd: root,
	stdio: "inherit",
});

// Clean stale output so Tauri never embeds files left by an earlier web build.
if (fs.existsSync(buildDir)) {
	fs.rmSync(buildDir, { recursive: true, force: true });
	console.log("Cleaned stale desktop web output.");
}

execSync("pnpm build", {
	cwd: root,
	env: { ...process.env, DISABLE_PWA: "true" },
	stdio: "inherit",
});

execFileSync(process.execPath, [strip], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, [bundleThumbnails], {
	cwd: root,
	stdio: "inherit",
});
execFileSync(process.execPath, [generateEnv], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, [verifySurface], {
	cwd: root,
	stdio: "inherit",
});
