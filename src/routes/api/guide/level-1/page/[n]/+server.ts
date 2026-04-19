// Autosave endpoint for guide page sidecar JSON.
// PUT /api/guide/level-1/page/[n] writes _data/page-NN.json atomically.

import { json, error, type RequestHandler } from '@sveltejs/kit';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { validateSidecar } from '../../../../../(public)/guide/level-1/_lib/sidecar-schema';

const DATA_ROOT = path.join(
	process.cwd(),
	'src',
	'routes',
	'(public)',
	'guide',
	'level-1',
	'_data'
);

export const PUT: RequestHandler = async ({ request, params }) => {
	const n = Number(params.n);
	if (!Number.isInteger(n) || n < 1 || n > 999) {
		throw error(400, `Invalid page param: ${params.n}`);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Body must be JSON');
	}

	try {
		validateSidecar(body);
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'Invalid sidecar');
	}

	if (body.pageNumber !== n) {
		throw error(
			400,
			`Body pageNumber ${body.pageNumber} does not match URL param ${n}`
		);
	}

	const finalPath = path.join(DATA_ROOT, `page-${String(n).padStart(2, '0')}.json`);
	const tmpPath = `${finalPath}.tmp`;
	await fs.mkdir(DATA_ROOT, { recursive: true });
	await fs.writeFile(tmpPath, JSON.stringify(body, null, 2), 'utf8');
	await fs.rename(tmpPath, finalPath);

	return json({ ok: true, pageNumber: n });
};
