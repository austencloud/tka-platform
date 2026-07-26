#!/usr/bin/env node

// npm entry point for Agent Hub. The real work lives in install.ps1 /
// uninstall.ps1; this shim finds them inside the package, picks a sane
// -ProjectsRoot when the caller didn't name one, and hands off to Windows
// PowerShell 5.1 (the version the installer's WPF + COM + csc path is built
// against).

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, parse as parsePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SCRIPTS = {
	install: 'install.ps1',
	uninstall: 'uninstall.ps1'
};

const HELP = `
  Agent Hub - taskbar popover that asks "Claude or Codex?" and opens the
  chosen agent in the project you clicked.

  Usage
    npx @austencloud/agent-hub [install|uninstall] [flags]

  Install flags (passed through to install.ps1)
    -ProjectsRoot <dir>   Folder holding your checkouts. Guessed if omitted.
    -NoAutoDiscover       Only install projects listed in projects.json.
    -NoLaunchers          Don't write start-*.bat into projects that lack them.
    -NoStartup            Don't register the resident host to run at logon.
    -NoOpen               Don't open the shortcut folder when finished.

  Uninstall flags
    -Purge                Also forget the remembered per-project agent.

  Windows only. Needs Windows Terminal and the .NET Framework 4.x feature.
`;

function fail(message) {
	console.error(`agent-hub: ${message}`);
	process.exit(1);
}

// Directories that hold git checkouts are the interesting ones. Run from inside
// a repo and the sibling folder is what the user means; run from a folder full
// of repos and that folder is what they mean.
function hasGitDir(dir) {
	try {
		return statSync(join(dir, '.git')).isDirectory() || existsSync(join(dir, '.git'));
	} catch {
		return false;
	}
}

function countChildRepos(dir) {
	try {
		return readdirSync(dir, { withFileTypes: true }).filter(
			(entry) => entry.isDirectory() && hasGitDir(join(dir, entry.name))
		).length;
	} catch {
		return 0;
	}
}

function guessProjectsRoot() {
	const cwd = process.cwd();
	if (hasGitDir(cwd)) {
		const parent = dirname(cwd);
		if (parent !== cwd && parent !== parsePath(cwd).root) return parent;
	}
	if (countChildRepos(cwd) > 0) return cwd;
	// Nothing obvious here - let install.ps1 run its own heuristic.
	return null;
}

function findPowerShell() {
	const systemRoot = process.env.SystemRoot || 'C:\\Windows';
	const candidates = [
		join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
		join(systemRoot, 'SysWOW64', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
	];
	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate;
	}
	// Last resort: whatever PATH resolves. pwsh 7 can run the installer, but
	// 5.1 is the tested path, so it is only reached when 5.1 is missing.
	return 'powershell.exe';
}

const argv = process.argv.slice(2);

if (argv.some((arg) => arg === '--help' || arg === '-h' || arg === '-?')) {
	console.log(HELP);
	process.exit(0);
}

let command = 'install';
let passthrough = argv;
if (argv.length > 0 && Object.prototype.hasOwnProperty.call(SCRIPTS, argv[0].toLowerCase())) {
	command = argv[0].toLowerCase();
	passthrough = argv.slice(1);
}

if (process.platform !== 'win32') {
	fail(
		`Windows only - it compiles WPF executables with the .NET Framework compiler and drives Windows Terminal (current platform: ${process.platform}).`
	);
}

const script = join(packageRoot, SCRIPTS[command]);
if (!existsSync(script)) fail(`${SCRIPTS[command]} is missing from the package at ${packageRoot}.`);

const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...passthrough];

if (command === 'install' && !passthrough.some((arg) => /^-ProjectsRoot$/i.test(arg))) {
	const guess = guessProjectsRoot();
	if (guess) args.push('-ProjectsRoot', guess);
}

const result = spawnSync(findPowerShell(), args, { stdio: 'inherit', windowsHide: false });

if (result.error) fail(result.error.message);
process.exit(result.status === null ? 1 : result.status);
