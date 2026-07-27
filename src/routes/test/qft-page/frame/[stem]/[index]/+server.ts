/**
 * Dev-only frame server for the QfT archive prototype.
 *
 * Serves one extracted frame of one animation. The frames are derived from the
 * private sourcing archive and stay there — see the sibling img/ route and
 * docs/reference/archive/qft-notation/README.md.
 */
import { error } from "@sveltejs/kit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RequestHandler } from "./$types";

const FRAMES = "docs/reference/archive/qft-notation/frames";

export const GET: RequestHandler = async ({ params }) => {
	if (!/^[a-z0-9]+$/.test(params.stem) || !/^[0-8]$/.test(params.index)) {
		throw error(400, "bad frame reference");
	}

	try {
		const bytes = await readFile(
			join(process.cwd(), FRAMES, params.stem, `${params.index}.webp`)
		);
		return new Response(new Uint8Array(bytes), {
			headers: { "content-type": "image/webp", "cache-control": "no-store" }
		});
	} catch {
		throw error(404, "not extracted");
	}
};
