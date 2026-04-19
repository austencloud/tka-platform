import { describe, it, expect } from 'vitest';
import { makePlacedAssetFromDrop } from '../../../src/routes/(public)/guide/level-1/_lib/library-drop';

describe('makePlacedAssetFromDrop', () => {
	const pageDims = { width: 800, height: 1000 };

	it('preserves the library entry id on libraryId', () => {
		const asset = makePlacedAssetFromDrop(
			{ id: 'lib-abc', kind: 'pictograph' },
			{ x: 100, y: 100 },
			pageDims
		);
		expect(asset.libraryId).toBe('lib-abc');
	});

	it('uses the entry kind as the asset type', () => {
		const pictograph = makePlacedAssetFromDrop(
			{ id: 'p1', kind: 'pictograph' },
			{ x: 0, y: 0 },
			pageDims
		);
		const sequence = makePlacedAssetFromDrop(
			{ id: 's1', kind: 'sequence' },
			{ x: 0, y: 0 },
			pageDims
		);
		expect(pictograph.type).toBe('pictograph');
		expect(sequence.type).toBe('sequence');
	});

	it('converts drop offset to pct of page dimensions', () => {
		const asset = makePlacedAssetFromDrop(
			{ id: 'p', kind: 'pictograph' },
			{ x: 200, y: 250 },
			pageDims
		);
		expect(asset.position.unit).toBe('pct');
		expect(asset.position.x).toBeCloseTo(25);
		expect(asset.position.y).toBeCloseTo(25);
	});

	it('sizes the new asset in pct so it scales with the page', () => {
		const asset = makePlacedAssetFromDrop(
			{ id: 'p', kind: 'pictograph' },
			{ x: 0, y: 0 },
			pageDims
		);
		expect(asset.size.unit).toBe('pct');
		expect(asset.size.width).toBeGreaterThan(0);
		expect(asset.size.height).toBeGreaterThan(0);
	});

	it('starts with stale bake state and an empty path', () => {
		const asset = makePlacedAssetFromDrop(
			{ id: 'p', kind: 'pictograph' },
			{ x: 0, y: 0 },
			pageDims
		);
		expect(asset.bake.stale).toBe(true);
		expect(asset.bake.path).toBe('');
		expect(asset.bake.lastBakedAt).toBe(0);
	});

	it('produces a non-empty unique id', () => {
		const a = makePlacedAssetFromDrop({ id: 'p', kind: 'pictograph' }, { x: 0, y: 0 }, pageDims);
		const b = makePlacedAssetFromDrop({ id: 'p', kind: 'pictograph' }, { x: 0, y: 0 }, pageDims);
		expect(typeof a.id).toBe('string');
		expect(a.id.length).toBeGreaterThan(0);
		expect(a.id).not.toBe(b.id);
	});

	it('handles zero-size page dims without throwing or producing NaN', () => {
		const asset = makePlacedAssetFromDrop(
			{ id: 'p', kind: 'pictograph' },
			{ x: 50, y: 50 },
			{ width: 0, height: 0 }
		);
		expect(Number.isFinite(asset.position.x)).toBe(true);
		expect(Number.isFinite(asset.position.y)).toBe(true);
	});
});
