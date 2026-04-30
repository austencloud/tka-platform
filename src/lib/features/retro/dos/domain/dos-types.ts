/**
 * TKA-OS DOS Era - Domain Types
 *
 * Core type definitions for the DOS terminal emulator: terminal output,
 * color schemes, modes, and the fake filesystem. These model the fictional
 * 1989 command-line environment built by the Bellweather Technical Institute.
 */

/** A line of terminal output. Supports colored spans via HTML. */
export interface TerminalLine {
	readonly html: string;
	readonly timestamp: number;
}

/** Terminal color for text spans */
export type DosColor = "green" | "amber" | "white" | "red" | "blue" | "gray" | "cyan";

/** Current terminal mode */
export type TerminalMode = "boot" | "prompt" | "scribe" | "app";

/** SCRIBE app sub-mode */
export type ScribeMode =
	| "menu"
	| "generate"
	| "construct"
	| "spell"
	| "browse"
	| "cards"
	| "tutorial"
	| "config";

/** A file in the fake DOS filesystem */
export interface DosFile {
	readonly name: string;
	readonly ext: string;
	readonly size: number;
	readonly date: string;
	readonly content?: string;
	readonly accessDenied?: boolean;
}

/** A directory in the fake DOS filesystem */
export interface DosDirectory {
	readonly name: string;
	readonly files: DosFile[];
	readonly subdirs: DosDirectory[];
}
