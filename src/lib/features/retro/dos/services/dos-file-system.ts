/**
 * Simulated DOS filesystem for TKAUTIL.COM.
 *
 * Models three top-level directories under C:\ - BELLWTHR (the working
 * directory), SYSTEM (driver files referenced by the boot sequence), and
 * TEMP (empty). File sizes are deterministic, seeded from each filename.
 * Dates fall within a narrow 1989 window.
 *
 * README.TXT content is drawn from the shared lore registry.
 * ORDER7.DOC is access-denied.
 */

import type { DosFile, DosDirectory } from "../domain/dos-types";
import { getAllLore } from "../../shared/lore/order-references";

/** Deterministic size from filename - simple hash to keep values stable across sessions */
function seedSize(name: string, base: number): number {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = (hash * 31 + name.charCodeAt(i)) | 0;
	}
	return base + (Math.abs(hash) % 1024);
}

/** Format a date as MM-DD-YY */
function formatDate(month: number, day: number, year: number): string {
	const mm = String(month).padStart(2, "0");
	const dd = String(day).padStart(2, "0");
	const yy = String(year).slice(-2);
	return `${mm}-${dd}-${yy}`;
}

// ---------------------------------------------------------------------------
// Static dates in the 1989 window
// ---------------------------------------------------------------------------
const DATE_RELEASE = formatDate(6, 15, 1989);
const DATE_ORDER = formatDate(3, 1, 1989);
const DATE_DRIVERS = formatDate(4, 22, 1989);
const DATE_SEQ = formatDate(7, 4, 1989);

// ---------------------------------------------------------------------------
// File content
// ---------------------------------------------------------------------------

function buildReadmeContent(): string {
	const loreLines = getAllLore("dos", "readme");
	return [
		"===============================================",
		"  TKAUTIL.COM  -  Installation Briefing",
		"  Bellweather Technical Institute, 1989",
		"===============================================",
		"",
		...loreLines,
		"",
		"INSTALLATION",
		"  1. Copy all files to C:\\BELLWTHR",
		"  2. Add C:\\BELLWTHR to PATH in AUTOEXEC.BAT",
		"  3. Run TKAUTIL.COM at the DOS prompt",
		"  4. Enter your Bellweather-issued serial number",
		"",
		"SYSTEM REQUIREMENTS",
		"  IBM PC/XT/AT or compatible",
		"  640K base RAM minimum",
		"  DOS 3.3 or later",
		"  Notation co-processor recommended",
		"",
		"SUPPORT",
		"  Contact your assigned Order liaison.",
		"  Do not contact Bellweather directly.",
		"",
		"===============================================",
		"  Distribution restricted under Directive 7",
		"===============================================",
	].join("\n");
}

const HELP_CONTENT = [
	"TKAUTIL.COM - Command Reference",
	"",
	"  DIR            List files in the current directory",
	"  DIR /SEQ       List sequence files only",
	"  TYPE <file>    Display the contents of a file",
	"  CD <dir>       Change directory",
	"  CD \\           Return to root",
	"  CLS            Clear the screen",
	"  VER            Display version information",
	"  HELP           Display this help text",
	"  SCRIBE         Launch the SCRIBE notation utility",
	"  GENERATE <w>   Generate a sequence for word <w>",
	"  SPELL <w>      Spell a word using TKA letters",
	"  REGISTER       Software registration",
	"",
	"  All commands are case-insensitive.",
].join("\n");

const CONFIG_CONTENT = [
	"REM TKAUTIL.COM Configuration",
	"REM Bellweather Technical Institute",
	"REM Last modified: 06/15/1989",
	"",
	"DEVICE=C:\\SYSTEM\\KINETIC.SYS",
	"DEVICE=C:\\SYSTEM\\SPIRAL.DRV",
	"DEVICE=C:\\SYSTEM\\NOTATION.DLL",
	"DEVICE=C:\\SYSTEM\\PROP.SYS",
	"DEVICE=C:\\SYSTEM\\GRID.DRV",
	"",
	"BUFFERS=20",
	"FILES=40",
	"STACKS=9,256",
	"",
	"REM Order Directive 7 compliance enforced at load time",
	"SET COMPLIANCE=STRICT",
	"SET CLEARANCE=LEVEL3",
].join("\n");

// ---------------------------------------------------------------------------
// Filesystem tree (built once, immutable)
// ---------------------------------------------------------------------------

function buildSequencesDir(): DosDirectory {
	const words = ["BOOK", "FLOW", "SPIN", "CAKE", "NOVA"];
	const files: DosFile[] = words.map((word) => ({
		name: word,
		ext: "SEQ",
		size: seedSize(word + ".SEQ", 3072),
		date: DATE_SEQ,
		content: `[Binary sequence data - use SCRIBE to view ${word}]`,
	}));
	return { name: "SEQUENCES", files, subdirs: [] };
}

function buildBellwthrDir(): DosDirectory {
	const sequencesDir = buildSequencesDir();
	const files: DosFile[] = [
		{
			name: "TKAUTIL",
			ext: "COM",
			size: seedSize("TKAUTIL.COM", 31744),
			date: DATE_RELEASE,
		},
		{
			name: "README",
			ext: "TXT",
			size: seedSize("README.TXT", 1536),
			date: DATE_RELEASE,
			content: buildReadmeContent(),
		},
		{
			name: "ORDER7",
			ext: "DOC",
			size: seedSize("ORDER7.DOC", 8192),
			date: DATE_ORDER,
			accessDenied: true,
		},
		{
			name: "REGISTER",
			ext: "COM",
			size: seedSize("REGISTER.COM", 4096),
			date: DATE_RELEASE,
		},
		{
			name: "CONFIG",
			ext: "SYS",
			size: seedSize("CONFIG.SYS", 256),
			date: DATE_RELEASE,
			content: CONFIG_CONTENT,
		},
		{
			name: "HELP",
			ext: "TXT",
			size: seedSize("HELP.TXT", 512),
			date: DATE_RELEASE,
			content: HELP_CONTENT,
		},
	];
	return { name: "BELLWTHR", files, subdirs: [sequencesDir] };
}

function buildSystemDir(): DosDirectory {
	const driverNames: [string, string][] = [
		["KINETIC", "SYS"],
		["SPIRAL", "DRV"],
		["NOTATION", "DLL"],
		["PROP", "SYS"],
		["GRID", "DRV"],
	];
	const files: DosFile[] = driverNames.map(([name, ext]) => ({
		name,
		ext,
		size: seedSize(`${name}.${ext}`, 2048),
		date: DATE_DRIVERS,
	}));
	return { name: "SYSTEM", files, subdirs: [] };
}

function buildTempDir(): DosDirectory {
	return { name: "TEMP", files: [], subdirs: [] };
}

function buildRoot(): DosDirectory {
	return {
		name: "",
		files: [],
		subdirs: [buildBellwthrDir(), buildSystemDir(), buildTempDir()],
	};
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DosFileSystem {
	private readonly root: DosDirectory;
	private currentDir: DosDirectory;
	private pathSegments: string[];

	constructor() {
		this.root = buildRoot();
		// Start in C:\BELLWTHR
		const bellwthr = this.root.subdirs.find((d) => d.name === "BELLWTHR");
		if (!bellwthr) throw new Error("Filesystem invariant: BELLWTHR not found");
		this.currentDir = bellwthr;
		this.pathSegments = ["BELLWTHR"];
	}

	getCurrentPath(): string {
		if (this.pathSegments.length === 0) return "C:\\";
		return "C:\\" + this.pathSegments.join("\\");
	}

	listFiles(filter?: string): DosFile[] {
		if (!filter) return [...this.currentDir.files];
		const extMatch = filter.replace("*.", "").toUpperCase();
		return this.currentDir.files.filter((f) => f.ext.toUpperCase() === extMatch);
	}

	listDirs(): DosDirectory[] {
		return [...this.currentDir.subdirs];
	}

	readFile(name: string): DosFile | null {
		const upper = name.toUpperCase();
		// Match with or without extension
		return (
			this.currentDir.files.find((f) => {
				const full = `${f.name}.${f.ext}`.toUpperCase();
				return full === upper || f.name.toUpperCase() === upper;
			}) ?? null
		);
	}

	changeDir(path: string): boolean {
		const normalized = path.trim().toUpperCase().replace(/\//g, "\\");

		// CD \ - return to root
		if (normalized === "\\") {
			this.currentDir = this.root;
			this.pathSegments = [];
			return true;
		}

		// CD .. - go up one level
		if (normalized === "..") {
			if (this.pathSegments.length === 0) return true; // already at root
			this.pathSegments.pop();
			this.currentDir = this.resolveFromRoot(this.pathSegments) ?? this.root;
			return true;
		}

		// Absolute path starting with C:\ or just \
		if (normalized.startsWith("C:\\") || normalized.startsWith("\\")) {
			const stripped = normalized.replace(/^C:\\?/, "").replace(/^\\/, "");
			if (stripped === "") {
				this.currentDir = this.root;
				this.pathSegments = [];
				return true;
			}
			const segments = stripped.split("\\").filter(Boolean);
			const target = this.resolveFromRoot(segments);
			if (target === null) return false;
			this.currentDir = target;
			this.pathSegments = segments;
			return true;
		}

		// Relative path - single directory name or nested
		const segments = normalized.split("\\").filter(Boolean);
		let dir: DosDirectory = this.currentDir;
		const newSegments = [...this.pathSegments];

		for (const seg of segments) {
			if (seg === "..") {
				if (newSegments.length > 0) {
					newSegments.pop();
					dir = this.resolveFromRoot(newSegments) ?? this.root;
				} else {
					dir = this.root;
				}
			} else {
				const child: DosDirectory | undefined = dir.subdirs.find(
					(d) => d.name.toUpperCase() === seg,
				);
				if (!child) return false;
				dir = child;
				newSegments.push(child.name);
			}
		}

		this.currentDir = dir;
		this.pathSegments = newSegments;
		return true;
	}

	getStats(): { fileCount: number; totalBytes: number; freeBytes: number } {
		let fileCount = 0;
		let totalBytes = 0;

		const walk = (dir: DosDirectory) => {
			for (const file of dir.files) {
				fileCount++;
				totalBytes += file.size;
			}
			for (const sub of dir.subdirs) {
				walk(sub);
			}
		};

		walk(this.currentDir);
		return { fileCount, totalBytes, freeBytes: 524288 };
	}

	/** Walk from root through the given path segments, returning the target directory or null */
	private resolveFromRoot(segments: string[]): DosDirectory | null {
		let dir: DosDirectory = this.root;
		for (const seg of segments) {
			const child = dir.subdirs.find((d) => d.name.toUpperCase() === seg.toUpperCase());
			if (!child) return null;
			dir = child;
		}
		return dir;
	}
}
