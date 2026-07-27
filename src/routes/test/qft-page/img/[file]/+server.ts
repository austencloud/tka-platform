/**
 * Dev-only image server for the QfT archive prototype.
 *
 * The archive is deliberately NOT in `static/` — it is a private sourcing
 * archive (docs/reference/archive/qft-notation/README.md) and nothing in it is
 * published. This route reads from that directory at request time so the
 * prototype can show the real restored images without copying them into the
 * build. If the page ever ships, the hosting question gets answered then.
 */
import { error } from "@sveltejs/kit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RequestHandler } from "./$types";

const ARCHIVE = "docs/reference/archive/qft-notation/images";

const TYPES: Record<string, string> = {
	gif: "image/gif",
	jpg: "image/jpeg"
};

export const GET: RequestHandler = async ({ params }) => {
	const name = params.file;
	if (!/^[a-z0-9]+\.(gif|jpg)$/.test(name)) throw error(400, "bad name");

	const ext = name.split(".").pop() as string;
	try {
		const bytes = await readFile(join(process.cwd(), ARCHIVE, name));
		return new Response(new Uint8Array(bytes), {
			headers: { "content-type": TYPES[ext] as string, "cache-control": "no-store" }
		});
	} catch {
		throw error(404, "not in archive");
	}
};
