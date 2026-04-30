#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const strip = path.resolve(__dirname, "strip-desktop-assets.cjs");
const buildDir = path.resolve(root, "build");

// Clean stale build output to prevent 1.5GB+ dirs from previous builds
if (fs.existsSync(buildDir)) {
	fs.rmSync(buildDir, { recursive: true, force: true });
	console.log("Cleaned stale build directory.");
}

// Build with TAURI_BUILD=true so Vite skips copying static/ (Unicode filename issues)
execSync(`cross-env DISABLE_PWA=true TAURI_BUILD=true pnpm build`, {
	cwd: root,
	stdio: "inherit",
});

// Copy only the static assets needed for desktop
execSync(`node "${strip}" --copy-static`, { cwd: root, stdio: "inherit" });
