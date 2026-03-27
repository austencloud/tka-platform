/**
 * Library Adapter — maps LibraryRepository data to DOS-style file listings
 *
 * Bridges the real library (Firestore-backed sequences) into the
 * RetroFileManager's FAT16 world. Each saved sequence becomes a .SEQ
 * file with an 8.3 DOS name, a size derived from beat count, and a date
 * pulled from the sequence's updatedAt timestamp.
 *
 * Domain: Retro File Manager
 */

import { container } from "$lib/shared/di";
import type { ILibraryRepository, LibraryQueryOptions } from "$lib/features/library/services/contracts/ILibraryRepository";
import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
import { FileNameConverter } from "../services/implementations/FileNameConverter";

export interface RetroFile {
	id: string;
	/** 8.3 format: "FIRFLOWB.SEQ" */
	dosName: string;
	/** Human-readable: "Fire Flow Basics" */
	fullName: string;
	/** Derived from beat count (128 bytes per beat) */
	size: number;
	date: Date;
	type: "SEQ" | "BAK";
	sequence: LibrarySequence;
}

const converter = new FileNameConverter();

/**
 * Firestore timestamps come back with a .toDate() method, but after
 * hydration they might already be plain Date objects. This handles both.
 */
function toDate(timestamp: unknown): Date {
	if (timestamp instanceof Date) return timestamp;
	if (timestamp && typeof (timestamp as { toDate: () => Date }).toDate === "function") {
		return (timestamp as { toDate: () => Date }).toDate();
	}
	return new Date();
}

function sequenceToRetroFile(seq: LibrarySequence, dosNames: string[]): RetroFile {
	const dosName = converter.convert(
		seq.displayName || seq.name || seq.word || "UNTITLED",
		".SEQ",
		dosNames,
	);
	dosNames.push(dosName);

	return {
		id: seq.id,
		dosName,
		fullName: seq.displayName || seq.name || seq.word || "Untitled",
		size: (seq.steps?.length ?? 0) * 128,
		date: toDate(seq.updatedAt),
		type: "SEQ" as const,
		sequence: seq,
	};
}

/**
 * Fetch all non-deleted sequences as DOS files, sorted by the given options.
 */
export async function listSequenceFiles(options?: {
	sortBy?: LibraryQueryOptions["sortBy"];
	sortDirection?: "asc" | "desc";
}): Promise<RetroFile[]> {
	const repo = container.items.libraryRepository as ILibraryRepository;
	const sequences = await repo.getSequences({
		sortBy: options?.sortBy ?? "updatedAt",
		sortDirection: options?.sortDirection ?? "desc",
	});

	const dosNames: string[] = [];
	return sequences
		.filter((seq) => !seq.isDeleted)
		.map((seq) => sequenceToRetroFile(seq, dosNames));
}

/**
 * Soft-delete a sequence (moves it to the recycle bin).
 */
export async function deleteFile(sequenceId: string): Promise<void> {
	const repo = container.items.libraryRepository as ILibraryRepository;
	await repo.softDeleteSequence(sequenceId);
}

/**
 * Subscribe to real-time library changes. Returns an unsubscribe function.
 * The callback receives the full file list on every change.
 */
export function subscribeToLibrary(callback: (files: RetroFile[]) => void): () => void {
	const repo = container.items.libraryRepository as ILibraryRepository;
	return repo.subscribeToLibrary((sequences) => {
		const dosNames: string[] = [];
		const files = sequences
			.filter((seq) => !seq.isDeleted)
			.map((seq) => sequenceToRetroFile(seq, dosNames));
		callback(files);
	});
}
