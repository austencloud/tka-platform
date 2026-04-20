import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	LibraryClient,
	makeEntryId
} from '../../../src/routes/(public)/guide/level-1/_lib/library-client';
import type {
	GuideLibrary,
	LibraryEntry
} from '../../../src/routes/(public)/guide/level-1/_lib/library-schema';

const ENDPOINT = '/api/guide/level-1/library';

describe('makeEntryId', () => {
	it('produces an id prefixed with the kind', () => {
		expect(makeEntryId('pictograph').startsWith('pictograph:')).toBe(true);
		expect(makeEntryId('sequence').startsWith('sequence:')).toBe(true);
	});

	it('produces unique ids across successive calls', () => {
		const ids = new Set<string>();
		for (let i = 0; i < 20; i++) ids.add(makeEntryId('pictograph'));
		expect(ids.size).toBe(20);
	});
});

describe('LibraryClient', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		// Each test installs its own mock.
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('fetch() returns a parsed, validated library', async () => {
		const lib: GuideLibrary = {
			version: 1,
			entries: [
				{
					id: 'pictograph:abc',
					kind: 'pictograph',
					label: 'Alpha',
					sourceData: { letter: 'A' },
					addedAt: 1_700_000_000_000
				}
			]
		};
		const mock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: 'OK',
			json: () => Promise.resolve(lib)
		});
		globalThis.fetch = mock as unknown as typeof fetch;

		const result = await new LibraryClient().fetch();
		expect(result).toEqual(lib);
		expect(mock).toHaveBeenCalledWith(ENDPOINT);
	});

	it('fetch() throws on non-ok response', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			statusText: 'Server Error'
		}) as unknown as typeof fetch;

		await expect(new LibraryClient().fetch()).rejects.toThrow(/500/);
	});

	it('append() POSTs the entry as JSON body', async () => {
		const entry: LibraryEntry = {
			id: 'sequence:xyz',
			kind: 'sequence',
			label: 'Demo',
			sourceData: { steps: [] },
			addedAt: 1_700_000_000_000
		};
		const mock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: 'OK',
			text: () => Promise.resolve('')
		});
		globalThis.fetch = mock as unknown as typeof fetch;

		await new LibraryClient().append(entry);

		expect(mock).toHaveBeenCalledTimes(1);
		const [url, init] = mock.mock.calls[0];
		expect(url).toBe(ENDPOINT);
		expect(init.method).toBe('POST');
		expect(init.headers).toEqual({ 'content-type': 'application/json' });
		expect(JSON.parse(init.body as string)).toEqual(entry);
	});

	it('replace() PUTs the library as JSON body', async () => {
		const lib: GuideLibrary = {
			version: 1,
			entries: [
				{
					id: 'pictograph:abc',
					kind: 'pictograph',
					label: 'Alpha',
					sourceData: { letter: 'A' },
					addedAt: 1_700_000_000_000
				}
			]
		};
		const mock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: 'OK',
			text: () => Promise.resolve('')
		});
		globalThis.fetch = mock as unknown as typeof fetch;

		await new LibraryClient().replace(lib);

		expect(mock).toHaveBeenCalledTimes(1);
		const [url, init] = mock.mock.calls[0];
		expect(url).toBe(ENDPOINT);
		expect(init.method).toBe('PUT');
		expect(init.headers).toEqual({ 'content-type': 'application/json' });
		expect(JSON.parse(init.body as string)).toEqual(lib);
	});

	it('append() surfaces server error message on failure', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			statusText: 'Bad Request',
			text: () => Promise.resolve('duplicate id')
		}) as unknown as typeof fetch;

		const entry: LibraryEntry = {
			id: 'pictograph:dup',
			kind: 'pictograph',
			label: 'X',
			sourceData: null,
			addedAt: 1
		};
		await expect(new LibraryClient().append(entry)).rejects.toThrow(/duplicate id/);
	});
});
