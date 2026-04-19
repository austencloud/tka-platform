import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Import the handler directly. It writes under process.cwd()/src/routes/...
// so we set a temp cwd to keep tests hermetic.

const ORIGINAL_CWD = process.cwd();
const TEMP_CWD = path.join(tmpdir(), 'guide-editor-autosave-test-' + Date.now());

beforeEach(async () => {
	await fs.mkdir(TEMP_CWD, { recursive: true });
	process.chdir(TEMP_CWD);
});

afterAll(async () => {
	process.chdir(ORIGINAL_CWD);
	await fs.rm(TEMP_CWD, { recursive: true, force: true });
});

// Late import after chdir so DATA_ROOT computes against the temp cwd.
async function importHandler() {
	// Use a dynamic import + cache-bust to ensure fresh module load per test.
	const mod = await import(
		'../../../src/routes/api/guide/level-1/page/[n]/+server?t=' + Date.now()
	);
	return mod.PUT;
}

function makeReq(body: unknown, n: string) {
	return {
		request: new Request('http://localhost/api/guide/level-1/page/' + n, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		params: { n },
		url: new URL('http://localhost/api/guide/level-1/page/' + n)
	} as unknown as Parameters<Awaited<ReturnType<typeof importHandler>>>[0];
}

describe('PUT /api/guide/level-1/page/[n]', () => {
	it('writes valid sidecar to disk', async () => {
		const PUT = await importHandler();
		const sidecar = {
			pageNumber: 5,
			text: { header: { type: 'doc' as const, content: [] } },
			placedAssets: []
		};
		const res = (await PUT(makeReq(sidecar, '5'))) as Response;
		expect(res.status).toBe(200);
		const written = await fs.readFile(
			path.join(TEMP_CWD, 'src', 'routes', '(public)', 'guide', 'level-1', '_data', 'page-05.json'),
			'utf8'
		);
		expect(JSON.parse(written)).toEqual(sidecar);
	});

	it('rejects mismatched pageNumber in body vs URL', async () => {
		const PUT = await importHandler();
		const sidecar = { pageNumber: 7, text: {}, placedAssets: [] };
		await expect(PUT(makeReq(sidecar, '5'))).rejects.toMatchObject({ status: 400 });
	});

	it('rejects invalid sidecar shape with 400', async () => {
		const PUT = await importHandler();
		const bad = { pageNumber: 5, text: 'not an object', placedAssets: [] };
		await expect(PUT(makeReq(bad, '5'))).rejects.toMatchObject({ status: 400 });
	});

	it('rejects non-numeric page param with 400', async () => {
		const PUT = await importHandler();
		const sidecar = { pageNumber: 5, text: {}, placedAssets: [] };
		await expect(PUT(makeReq(sidecar, 'abc'))).rejects.toMatchObject({ status: 400 });
	});

	it('rejects out-of-range page param with 400', async () => {
		const PUT = await importHandler();
		const sidecar = { pageNumber: 5, text: {}, placedAssets: [] };
		await expect(PUT(makeReq(sidecar, '0'))).rejects.toMatchObject({ status: 400 });
		await expect(PUT(makeReq(sidecar, '1000'))).rejects.toMatchObject({ status: 400 });
	});
});
