/**
 * Interface for the simulated DOS filesystem.
 *
 * Models a minimal FAT-style directory tree with three top-level directories
 * (BELLWTHR, SYSTEM, TEMP) rooted at C:\. Files carry deterministic sizes,
 * 1989-era dates, and optional text content that the TYPE command can display.
 */

import type { DosFile, DosDirectory } from "../../domain/dos-types";

export interface IDosFileSystem {
	/** Get the current working directory path (e.g. "C:\\BELLWTHR") */
	getCurrentPath(): string;

	/** List files in the current directory, optionally filtered by extension glob (e.g. "*.SEQ") */
	listFiles(filter?: string): DosFile[];

	/** List subdirectories in the current directory */
	listDirs(): DosDirectory[];

	/** Read a file by name (with or without extension). Returns null if not found. */
	readFile(name: string): DosFile | null;

	/** Change directory. Supports absolute paths, relative names, "..", and "\" for root. */
	changeDir(path: string): boolean;

	/** Aggregate stats for DIR footer: total file count, total bytes, free bytes */
	getStats(): { fileCount: number; totalBytes: number; freeBytes: number };
}
