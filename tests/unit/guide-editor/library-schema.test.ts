import { describe, it, expect } from 'vitest';
import {
	emptyLibrary,
	isLibraryEntry,
	validateLibrary,
	countPlacements,
	type LibraryEntry
} from '../../../src/routes/(public)/guide/level-1/_lib/library-schema';

const validEntry: LibraryEntry = {
	id: 'pictograph:abc123',
	kind: 'pictograph',
	label: 'Alpha-1 to Beta-3',
	sourceData: { letter: 'A', start: 'alpha-1' },
	thumbnailPath: '/guide/level-1/baked/abc123.svg',
	addedAt: 1_700_000_000_000,
	tags: ['type1', 'alpha']
};

describe('library-schema', () => {
	it('emptyLibrary is valid', () => {
		const lib = emptyLibrary();
		expect(() => validateLibrary(lib)).not.toThrow();
		expect(lib.entries).toEqual([]);
		expect(lib.version).toBe(1);
	});

	it('accepts a well-formed library', () => {
		expect(() =>
			validateLibrary({ version: 1, entries: [validEntry] })
		).not.toThrow();
	});

	it('rejects wrong version', () => {
		expect(() =>
			validateLibrary({ version: 2, entries: [] })
		).toThrow(/version must be 1/);
	});

	it('rejects non-array entries', () => {
		expect(() =>
			validateLibrary({ version: 1, entries: { foo: 'bar' } })
		).toThrow(/entries must be an array/);
	});

	it('rejects duplicate entry ids', () => {
		expect(() =>
			validateLibrary({
				version: 1,
				entries: [validEntry, { ...validEntry }]
			})
		).toThrow(/duplicate entry id/);
	});

	it('isLibraryEntry rejects missing id', () => {
		expect(isLibraryEntry({ ...validEntry, id: '' })).toBe(false);
		expect(isLibraryEntry({ ...validEntry, id: undefined })).toBe(false);
	});

	it('isLibraryEntry rejects unknown kind', () => {
		expect(isLibraryEntry({ ...validEntry, kind: 'animation' })).toBe(false);
	});

	it('isLibraryEntry accepts entry without optional fields', () => {
		const minimal = {
			id: 'p1',
			kind: 'pictograph' as const,
			label: 'x',
			sourceData: {},
			addedAt: Date.now()
		};
		expect(isLibraryEntry(minimal)).toBe(true);
	});

	it('countPlacements counts library ids across pages', () => {
		const counts = countPlacements([
			{
				placedAssets: [
					{ libraryId: 'p1' },
					{ libraryId: 'p2' },
					{ libraryId: 'p1' }
				]
			},
			{ placedAssets: [{ libraryId: 'p1' }, {}] }
		]);
		expect(counts.get('p1')).toBe(3);
		expect(counts.get('p2')).toBe(1);
		expect(counts.size).toBe(2);
	});

	it('countPlacements ignores assets without libraryId', () => {
		const counts = countPlacements([{ placedAssets: [{}, {}] }]);
		expect(counts.size).toBe(0);
	});
});
