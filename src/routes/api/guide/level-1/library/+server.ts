// Library autosave/append endpoint for the guide editor.
//
// PUT  /api/guide/level-1/library          replaces the entire library JSON.
// POST /api/guide/level-1/library          appends a single LibraryEntry.
//
// Both are DEV-ONLY by design — production reads the file as a static asset
// committed to the repo. A real prod-side persistence target (Firestore /
// KV / D1) belongs in Phase 4+ alongside the bake pipeline.

import { json, error, type RequestHandler } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
	emptyLibrary,
	isLibraryEntry,
	validateLibrary,
	type GuideLibrary,
	type LibraryEntry
} from '../../../../(public)/guide/level-1/_lib/library-schema';

const LIBRARY_PATH = path.join(
	process.cwd(),
	'static',
	'guide',
	'level-1',
	'library.json'
);

async function readLibrary(): Promise<GuideLibrary> {
	try {
		const raw = await fs.readFile(LIBRARY_PATH, 'utf8');
		const parsed = JSON.parse(raw) as unknown;
		validateLibrary(parsed);
		return parsed;
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
			return emptyLibrary();
		}
		throw e;
	}
}

async function writeLibrary(lib: GuideLibrary): Promise<void> {
	await fs.mkdir(path.dirname(LIBRARY_PATH), { recursive: true });
	const tmp = `${LIBRARY_PATH}.tmp`;
	await fs.writeFile(tmp, JSON.stringify(lib, null, 2), 'utf8');
	await fs.rename(tmp, LIBRARY_PATH);
}

export const PUT: RequestHandler = async ({ request }) => {
	if (!dev) throw error(404, 'Guide editor library is dev-only');

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Body must be JSON');
	}

	try {
		validateLibrary(body);
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'Invalid library');
	}

	await writeLibrary(body);
	return json({ ok: true, count: body.entries.length });
};

export const POST: RequestHandler = async ({ request }) => {
	if (!dev) throw error(404, 'Guide editor library is dev-only');

	let entry: unknown;
	try {
		entry = await request.json();
	} catch {
		throw error(400, 'Body must be JSON');
	}

	if (!isLibraryEntry(entry)) {
		throw error(400, 'Body must be a valid LibraryEntry');
	}

	const lib = await readLibrary();
	if (lib.entries.some((e: LibraryEntry) => e.id === entry.id)) {
		throw error(409, `LibraryEntry id "${entry.id}" already exists`);
	}
	lib.entries.push(entry);
	await writeLibrary(lib);
	return json({ ok: true, id: entry.id, count: lib.entries.length });
};

export const GET: RequestHandler = async () => {
	const lib = await readLibrary();
	return json(lib);
};
