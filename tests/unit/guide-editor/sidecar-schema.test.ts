import { describe, it, expect } from 'vitest';
import {
	validateSidecar,
	isPlacedAsset,
	emptySidecar,
	emptyTipTapDoc,
	type PageSidecar
} from '../../../src/routes/(public)/guide/level-1/_lib/sidecar-schema';

describe('validateSidecar', () => {
	it('accepts a minimal valid sidecar', () => {
		const sidecar: PageSidecar = {
			pageNumber: 5,
			text: { header: { type: 'doc', content: [] } },
			placedAssets: []
		};
		expect(() => validateSidecar(sidecar)).not.toThrow();
	});

	it('rejects sidecar missing pageNumber', () => {
		const bad: unknown = { text: {}, placedAssets: [] };
		expect(() => validateSidecar(bad)).toThrow(/pageNumber/);
	});

	it('rejects sidecar with non-integer pageNumber', () => {
		const bad: unknown = { pageNumber: 5.5, text: {}, placedAssets: [] };
		expect(() => validateSidecar(bad)).toThrow(/pageNumber/);
	});

	it('rejects sidecar with non-array placedAssets', () => {
		const bad: unknown = { pageNumber: 5, text: {}, placedAssets: 'nope' };
		expect(() => validateSidecar(bad)).toThrow(/placedAssets/);
	});

	it('rejects placedAsset missing required fields', () => {
		const bad: unknown = {
			pageNumber: 5,
			text: {},
			placedAssets: [{ id: 'a', type: 'pictograph' }]
		};
		expect(() => validateSidecar(bad)).toThrow(/placedAssets/);
	});

	it('rejects null/undefined input', () => {
		expect(() => validateSidecar(null)).toThrow();
		expect(() => validateSidecar(undefined)).toThrow();
	});
});

describe('isPlacedAsset', () => {
	it('accepts a complete placed asset', () => {
		const asset = {
			id: 'abc',
			type: 'pictograph' as const,
			sourceData: {},
			position: { x: 100, y: 200, unit: 'px' as const },
			size: { width: 150, height: 150, unit: 'px' as const },
			overrides: {},
			bake: { path: '', stale: true, lastBakedAt: 0 }
		};
		expect(isPlacedAsset(asset)).toBe(true);
	});

	it('rejects asset with invalid type', () => {
		expect(isPlacedAsset({ type: 'banana' })).toBe(false);
	});

	it('rejects asset with empty id', () => {
		const asset = {
			id: '',
			type: 'pictograph',
			sourceData: {},
			position: { x: 0, y: 0, unit: 'px' },
			size: { width: 1, height: 1, unit: 'px' },
			overrides: {},
			bake: { path: '', stale: true, lastBakedAt: 0 }
		};
		expect(isPlacedAsset(asset)).toBe(false);
	});

	it('rejects asset with bad position unit', () => {
		const asset = {
			id: 'x',
			type: 'pictograph',
			sourceData: {},
			position: { x: 0, y: 0, unit: 'em' },
			size: { width: 1, height: 1, unit: 'px' },
			overrides: {},
			bake: { path: '', stale: true, lastBakedAt: 0 }
		};
		expect(isPlacedAsset(asset)).toBe(false);
	});
});

describe('emptySidecar', () => {
	it('produces a valid sidecar for the given pageNumber', () => {
		const s = emptySidecar(7);
		expect(() => validateSidecar(s)).not.toThrow();
		expect(s.pageNumber).toBe(7);
		expect(s.placedAssets).toEqual([]);
	});
});

describe('emptyTipTapDoc', () => {
	it('returns a doc with one empty paragraph', () => {
		const d = emptyTipTapDoc();
		expect(d.type).toBe('doc');
		expect(d.content).toEqual([{ type: 'paragraph' }]);
	});
});
