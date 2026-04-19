// Pure helper for converting a library drop event into a fresh PlacedAsset.
// Extracted from PlacedAssetsLayer so it's unit-testable without DOM mocking.

import type { PlacedAsset } from './sidecar-schema';

export type LibraryDropEntry = { id: string; kind: 'pictograph' | 'sequence' };

export const LIBRARY_DRAG_MIME = 'application/x-tka-library-entry';

export function makePlacedAssetFromDrop(
	entry: LibraryDropEntry,
	dropOffset: { x: number; y: number },
	pageDims: { width: number; height: number }
): PlacedAsset {
	const xPct = pageDims.width > 0 ? (dropOffset.x / pageDims.width) * 100 : 0;
	const yPct = pageDims.height > 0 ? (dropOffset.y / pageDims.height) * 100 : 0;
	return {
		id: crypto.randomUUID(),
		type: entry.kind,
		libraryId: entry.id,
		sourceData: null,
		position: { x: xPct, y: yPct, unit: 'pct' },
		size: { width: 25, height: 25, unit: 'pct' },
		overrides: {},
		bake: { path: '', stale: true, lastBakedAt: 0 }
	};
}
