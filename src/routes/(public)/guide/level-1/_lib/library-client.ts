// Browser-side client for the library API. Used by the editor's library
// panel to fetch + append entries. Server endpoints live at
// /api/guide/level-1/library (GET, POST, PUT — see +server.ts).

import {
	emptyLibrary,
	validateLibrary,
	type GuideLibrary,
	type LibraryEntry
} from './library-schema';

const ENDPOINT = '/api/guide/level-1/library';

export class LibraryClient {
	async fetch(): Promise<GuideLibrary> {
		const res = await fetch(ENDPOINT);
		if (!res.ok) {
			throw new Error(`Library fetch failed: ${res.status} ${res.statusText}`);
		}
		const body = (await res.json()) as unknown;
		validateLibrary(body);
		return body;
	}

	async append(entry: LibraryEntry): Promise<void> {
		const res = await fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(entry)
		});
		if (!res.ok) {
			const msg = await res.text().catch(() => res.statusText);
			throw new Error(`Library append failed: ${msg}`);
		}
	}

	async replace(lib: GuideLibrary): Promise<void> {
		validateLibrary(lib);
		const res = await fetch(ENDPOINT, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(lib)
		});
		if (!res.ok) {
			const msg = await res.text().catch(() => res.statusText);
			throw new Error(`Library replace failed: ${msg}`);
		}
	}
}

export function makeEntryId(kind: 'pictograph' | 'sequence'): string {
	const rand = Math.random().toString(36).slice(2, 10);
	return `${kind}:${Date.now().toString(36)}-${rand}`;
}

export const emptyClientLibrary = emptyLibrary;
