/**
 * Lift the 2011 frames off their white card so they can be drawn INTO the page.
 *
 * The restored frames are line art printed on flat white. On a dark page that
 * white becomes a hard rectangle, and the drawing reads as a screenshot glued
 * onto a website rather than as part of it. Nothing about the drawing needs to
 * change to fix that — only the paper it was printed on.
 *
 * Straight un-matting is not enough on its own. Removing a white matte gives
 * every light tint a low alpha, so the salmon position circles come out at ~29%
 * and vanish against a dark background; and the black linework stays black,
 * which is invisible there. So this does three things per pixel:
 *
 *   1. Un-matte. alpha = 1 - min(r,g,b), colour = (c - white·(1-alpha)) / alpha.
 *      White paper goes to alpha 0 and drops out; ink keeps its own hue.
 *   2. Re-ink by chroma. Neutral pixels — the linework, the numerals, their
 *      antialiasing — are the drawing's "black", so they become the page's ink
 *      colour. Saturated pixels are the drawing's actual colour decisions (the red
 *      head, the blue hand) and keep their hue, normalised and lifted so they
 *      still read against a dark field.
 *   3. Curve the alpha. Light tints carry little ink by construction, so a
 *      gamma lifts them back to something visible without touching solids.
 *
 * The published white-card frames stay exactly as they are. The page ships both
 * and offers "as published", because recolouring an artifact on a page whose
 * claim is faithful restoration has to be reversible and labelled.
 *
 * Usage: node scripts/compose-qft-frames.mjs
 */

import { readdir, access } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const SRC = "docs/reference/archive/qft-notation/frames";
const OUT = "static/qft-frames";

/** The page's ink. Everything neutral in the drawing is redrawn in this. */
const INK = [232, 236, 255];

/**
 * Chroma below this is the drawing's linework rather than a colour choice.
 * The drawing's reds and blues sit far above it; JPEG-ish fringing sits below.
 */
const CHROMA_FLOOR = 26;

/**
 * Alpha gamma. Below 1 lifts partial coverage — the light fills — while leaving
 * alpha 0 and alpha 1 untouched, so paper stays gone and solids stay solid.
 */
const ALPHA_GAMMA = 0.62;

/** How far a saturated colour is pulled toward white so it reads on a dark page. */
const LIFT = 0.28;

/**
 * Coverage below this is not ink.
 *
 * These are 2011 GIFs off a forum: faint halos around strokes, compression
 * fringing, and the ghost of a cropped panel edge. All of it is invisible
 * printed on white and all of it survives un-matting as a very low alpha — which
 * the gamma below would then lift into something you can see. Cut it first, and
 * rescale what remains so a real light tint does not lose the coverage it had.
 */
const NOISE_FLOOR = 0.08;

function compose(data, pixels) {
	const out = Buffer.alloc(pixels * 4);

	for (let p = 0; p < pixels; p += 1) {
		const i = p * 4;
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];

		const min = Math.min(r, g, b);
		const max = Math.max(r, g, b);
		const coverage = 1 - min / 255;
		const alpha = (coverage - NOISE_FLOOR) / (1 - NOISE_FLOOR);

		if (alpha <= 0.004) {
			// Paper.
			out[i] = 0;
			out[i + 1] = 0;
			out[i + 2] = 0;
			out[i + 3] = 0;
			continue;
		}

		/*
		 * Un-matte against white to recover the ink's own colour. This uses the
		 * true coverage, not the floored alpha — the floor is an opacity
		 * decision, and folding it into the colour recovery would shift the hue.
		 */
		const unmatte = (c) => (c / 255 - (1 - coverage)) / coverage;
		const cr = unmatte(r);
		const cg = unmatte(g);
		const cb = unmatte(b);

		let R;
		let G;
		let B;

		if (max - min < CHROMA_FLOOR) {
			// Linework. The drawing's black is the page's ink.
			[R, G, B] = INK;
		} else {
			/*
			 * A colour decision. Normalise so the hue survives un-matting at any
			 * tint strength, then lift toward white — a fully saturated blue is
			 * nearly as dark as the page it now sits on.
			 */
			const peak = Math.max(cr, cg, cb, 0.001);
			const lift = (c) => {
				const norm = Math.max(0, c) / peak;
				return Math.round((norm * (1 - LIFT) + LIFT) * 255);
			};
			R = lift(cr);
			G = lift(cg);
			B = lift(cb);
		}

		out[i] = R;
		out[i + 1] = G;
		out[i + 2] = B;
		out[i + 3] = Math.round(Math.min(1, alpha ** ALPHA_GAMMA) * 255);
	}

	return out;
}

async function composeStem(stem) {
	const dir = join(SRC, stem);
	const files = (await readdir(dir)).filter((f) => /^\d+\.webp$/.test(f)).sort();

	for (const file of files) {
		const src = join(dir, file);
		const { data, info } = await sharp(src)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		const composed = compose(data, info.width * info.height);

		await sharp(composed, { raw: { width: info.width, height: info.height, channels: 4 } })
			.webp({ quality: 92, alphaQuality: 100 })
			.toFile(join(OUT, stem, file.replace(".webp", "-ink.webp")));
	}

	return files.length;
}

/*
 * Driven by what the page actually ships rather than by what the archive holds.
 * The archive is the full extraction and stays private; static/ is the excerpt.
 */
const stems = (await readdir(OUT, { withFileTypes: true }))
	.filter((e) => e.isDirectory())
	.map((e) => e.name);

for (const stem of stems) {
	try {
		await access(join(SRC, stem));
	} catch {
		console.log(`${stem}: no archive frames, skipped`);
		continue;
	}
	const n = await composeStem(stem);
	console.log(`${stem}: ${n} frames composed`);
}

console.log(`\n${stems.length} animations`);
