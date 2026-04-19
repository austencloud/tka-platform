// Guide library schema. The library is a flat collection of asset entries
// the editor can drag onto pages. Each entry tracks how many times it has
// been placed in the guide so the user can see "1 / 1 placed" badges and
// add extra copies via right-click.
//
// Persistence: a single JSON file at static/guide/level-1/library.json,
// editable through the dev-only PUT endpoint. Production reads the file as
// committed source; new entries are added during dev sessions.

export type LibraryEntryKind = 'pictograph' | 'sequence';

export interface LibraryEntry {
	/** Stable id; matches the id used by PlacedAsset.libraryEntryId. */
	id: string;
	kind: LibraryEntryKind;
	/** Short human label shown in the library tile. */
	label: string;
	/** Source of truth for re-rendering. Opaque to the editor; baker reads. */
	sourceData: unknown;
	/** Path to a baked thumbnail (relative to /static). */
	thumbnailPath?: string;
	/** When this entry was added to the library. */
	addedAt: number;
	/** Free-form tags for filtering ("alpha", "type1", "loop:rotated", ...). */
	tags?: string[];
}

export interface GuideLibrary {
	version: 1;
	entries: LibraryEntry[];
}

const KINDS = new Set<LibraryEntryKind>(['pictograph', 'sequence']);

export function emptyLibrary(): GuideLibrary {
	return { version: 1, entries: [] };
}

export function isLibraryEntry(v: unknown): v is LibraryEntry {
	if (typeof v !== 'object' || v === null) return false;
	const e = v as Record<string, unknown>;
	if (typeof e.id !== 'string' || e.id.length === 0) return false;
	if (typeof e.kind !== 'string' || !KINDS.has(e.kind as LibraryEntryKind)) return false;
	if (typeof e.label !== 'string') return false;
	if (typeof e.addedAt !== 'number' || !Number.isFinite(e.addedAt)) return false;
	if (e.thumbnailPath !== undefined && typeof e.thumbnailPath !== 'string') return false;
	if (e.tags !== undefined) {
		if (!Array.isArray(e.tags)) return false;
		if (!e.tags.every((t) => typeof t === 'string')) return false;
	}
	return true;
}

export function validateLibrary(v: unknown): asserts v is GuideLibrary {
	if (typeof v !== 'object' || v === null) {
		throw new Error('Library must be an object');
	}
	const lib = v as Record<string, unknown>;
	if (lib.version !== 1) {
		throw new Error(`Library.version must be 1; got ${String(lib.version)}`);
	}
	if (!Array.isArray(lib.entries)) {
		throw new Error('Library.entries must be an array');
	}
	for (let i = 0; i < lib.entries.length; i++) {
		if (!isLibraryEntry(lib.entries[i])) {
			throw new Error(`Library.entries[${i}] is not a valid LibraryEntry`);
		}
	}
	const seen = new Set<string>();
	for (const e of lib.entries as LibraryEntry[]) {
		if (seen.has(e.id)) {
			throw new Error(`Library has duplicate entry id "${e.id}"`);
		}
		seen.add(e.id);
	}
}

/**
 * Count how many times each library entry id appears across a set of pages'
 * placedAssets. Used by the library panel to show "N placed" badges. The
 * field name matches PlacedAsset.libraryId in sidecar-schema.ts.
 */
export function countPlacements(
	pages: Array<{ placedAssets: Array<{ libraryId?: string }> }>
): Map<string, number> {
	const counts = new Map<string, number>();
	for (const page of pages) {
		for (const a of page.placedAssets) {
			if (typeof a.libraryId !== 'string') continue;
			counts.set(a.libraryId, (counts.get(a.libraryId) ?? 0) + 1);
		}
	}
	return counts;
}
