/**
 * Publish the 2011 diagrams to static/, whole and uncropped.
 *
 * The page used to ship a cropped set: `extract-qft-frames.mjs` finds the region
 * that changes between frames and trims to it, which drops the notation panels
 * and captions that sit beside or below several of the diagrams. That made sense
 * while a diagram had to sit beside the computed stage and match its box. It
 * does not make sense now that they live in an archive view — an archive shows
 * the artifact as it was posted, corners and side panels included, or it is not
 * an archive.
 *
 * So this takes every frame at full source size and writes it straight to
 * static/. Nine frames per animation: the eight increments plus the closing
 * frame back to the start. Frame index is step index, unchanged.
 *
 * The cropping extractor stays as it is — it still feeds the private archive.
 * This is the shipping path.
 *
 * Usage: node scripts/publish-qft-frames.mjs
 */

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const SRC = "docs/reference/archive/qft-notation/images";
const OUT = "static/qft-frames";

/** Only the animations the guide actually references. static/ is the excerpt. */
const SHIPPED = new Set([
	"antispindiranimated",
	"cateyeanimated",
	"extension",
	"inspindiranimated",
	"isolationanimated",
	"pendulum",
	"static2",
	"triquetraanimated"
]);

async function publish(file) {
	const stem = file.replace(/\.(gif|jpg)$/, "");
	const path = join(SRC, file);

	const meta = await sharp(path, { animated: true }).metadata();
	const frameCount = meta.pages ?? 1;
	const width = meta.width ?? 0;
	const height = meta.pageHeight ?? meta.height ?? 0;

	/*
	 * Animated input decodes as one tall strip of pages, and channel count comes
	 * from the decoder rather than an assumption — these GIFs carry a
	 * transparency index, so they arrive as RGBA. Reading them as RGB shears
	 * every row by a byte per pixel and the frames come out as noise.
	 */
	const { data: strip, info } = await sharp(path, { animated: true })
		.raw()
		.toBuffer({ resolveWithObject: true });
	const channels = info.channels;
	const bytesPerFrame = width * height * channels;

	const dir = join(OUT, stem);
	await mkdir(dir, { recursive: true });

	/* Clear the old cropped and composed sets rather than leaving them orphaned. */
	for (const stale of await readdir(dir)) {
		if (stale.endsWith(".webp")) await rm(join(dir, stale));
	}

	for (let i = 0; i < frameCount; i += 1) {
		await sharp(strip.subarray(i * bytesPerFrame, (i + 1) * bytesPerFrame), {
			raw: { width, height, channels }
		})
			/* The GIFs' transparent index composites to the white they were drawn on. */
			.flatten({ background: "#ffffff" })
			.webp({ quality: 92 })
			.toFile(join(dir, `${i}.webp`));
	}

	return { stem, frames: frameCount, width, height };
}

const files = (await readdir(SRC))
	.filter((f) => f.endsWith(".gif"))
	.filter((f) => SHIPPED.has(f.replace(/\.gif$/, "")))
	.sort();

const manifest = [];
for (const f of files) {
	const entry = await publish(f);
	manifest.push(entry);
	console.log(`${entry.stem}: ${entry.frames} frames at ${entry.width}x${entry.height}`);
}

/*
 * Written next to the frames so the page can size each plate to the drawing's
 * real proportions without hardcoding a number per animation.
 */
await writeFile(
	join(OUT, "manifest.json"),
	`${JSON.stringify(
		Object.fromEntries(manifest.map((m) => [m.stem, { width: m.width, height: m.height }])),
		null,
		"\t"
	)}\n`
);

console.log(`\n${manifest.length} animations published whole`);
