/**
 * Recycle Adapter - bridges the soft-delete system into TKA-OS
 *
 * Maps soft-deleted LibrarySequences to DOS-style entries for the
 * Recycle Bin window. Exposes restore, purge, and empty-bin operations.
 *
 * Domain: Retro Recycle Bin
 */

import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
import { FileNameConverter } from "../services/implementations/FileNameConverter";

import { getLibraryRepository } from "$lib/features/library/getLibraryRepository";

export interface RecycleBinItem {
	id: string;
	/** 8.3 format: "FIRFLOWB.SEQ" */
	dosName: string;
	/** Human-readable: "Fire Flow Basics" */
	fullName: string;
	/** When the sequence was soft-deleted */
	deletedAt: Date;
	/** Derived from beat count (128 bytes per beat) */
	size: number;
}

const converter = new FileNameConverter();

/**
 * Firestore timestamps come back with a .toDate() method, but after
 * hydration they might already be plain Date objects. Handles both.
 */
function toDate(timestamp: unknown): Date {
	if (timestamp instanceof Date) return timestamp;
	if (
		timestamp &&
		typeof (timestamp as { toDate: () => Date }).toDate === "function"
	) {
		return (timestamp as { toDate: () => Date }).toDate();
	}
	return new Date();
}

/**
 * Load all soft-deleted sequences, sorted newest-deleted-first,
 * and format them as Recycle Bin items.
 */
export async function getDeletedItems(): Promise<RecycleBinItem[]> {
	const repo = getLibraryRepository() as ILibraryRepository;
	const deleted = await repo.getDeletedSequences();

	// Sort by deletedAt descending (most recently deleted first)
	deleted.sort((a, b) => {
		const aTime = toDate(a.deletedAt).getTime();
		const bTime = toDate(b.deletedAt).getTime();
		return bTime - aTime;
	});

	const dosNames: string[] = [];
	return deleted.map((seq) => {
		const fullName =
			seq.displayName || seq.name || seq.word || "Untitled";
		const dosName = converter.convert(fullName, ".SEQ", dosNames);
		dosNames.push(dosName);

		return {
			id: seq.id,
			dosName,
			fullName,
			deletedAt: toDate(seq.deletedAt),
			size: (seq.steps?.length ?? 0) * 128,
		};
	});
}

/**
 * Restore a soft-deleted sequence back to the active library.
 */
export async function restoreItem(id: string): Promise<void> {
	const repo = getLibraryRepository() as ILibraryRepository;
	await repo.restoreSequence(id);
}

/**
 * Permanently delete a single soft-deleted sequence. No recovery after this.
 */
export async function purgeItem(id: string): Promise<void> {
	const repo = getLibraryRepository() as ILibraryRepository;
	await repo.purgeSequence(id);
}

/**
 * Permanently delete all soft-deleted sequences. No recovery after this.
 */
export async function emptyBin(): Promise<void> {
	const repo = getLibraryRepository() as ILibraryRepository;
	await repo.emptyRecycleBin();
}
