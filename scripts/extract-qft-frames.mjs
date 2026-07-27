/**
 * Extract the nine frames of each QfT archive GIF so the page can drive them
 * itself.
 *
 * Why this exists: a browser gives no control over GIF playback — no seek, no
 * pause, no frame access. An <img> runs on its own clock, so Charlie's 2011
 * animation and the computed model drift apart within seconds of page load.
 * Rendering frame `i` ourselves whenever the model sits at step `i` makes drift
 * impossible rather than merely small.
 *
 * Every GIF in the archive holds exactly nine frames: the eight increments plus
 * the closing frame that returns to the start. Frame index IS step index.
 *
 * Two of the source GIFs have a notation table rendered into the frame beside
 * the circle. Rather than hand-pick crop boxes, this finds the region that
 * actually changes between frames — the animation — and crops to that. Static
 * furniture falls away on its own.
 *
 * Reads and writes only inside the private archive. Nothing here goes to
 * static/. See docs/reference/archive/qft-notation/README.md.
 *
 * Usage: node scripts/extract-qft-frames.mjs
 */

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const SRC = "docs/reference/archive/qft-notation/images";
const OUT = "docs/reference/archive/qft-notation/frames";

/** A channel difference this small between frames is JPEG-ish noise, not motion. */
const MOTION_THRESHOLD = 24;
/** Breathing room around the moving region so strokes are not clipped. */
const PAD = 12;

/**
 * Where gutter detection is wrong, and why.
 *
 * The split looks for a run of still columns between the diagram and its table
 * panel. Two of the eleven have an internal gap wider than that threshold, so
 * the run ends early and the crop clips the drawing. Raising the threshold
 * instead lets the table back into the files that sit close to theirs — one
 * global number cannot serve both. Eleven is a fixed, fully inspected set, so
 * these two carry the right edge explicitly rather than the script carrying a
 * heuristic tuned until it happens to pass.
 */
const RIGHT_EDGE = {
	static2: 385,
	triquetraanimated: 430
};

/**
 * Triquetra is the one whose table sits BELOW its diagram rather than beside
 * it, so no column-based split can reach it. The panels are not laid out
 * consistently across the eleven — another reason the fixed set is inspected
 * rather than trusted to a rule.
 */
const BOTTOM_EDGE = {
	triquetraanimated: 255
};

/**
 * Bounding box of pixels that differ across frames.
 *
 * Compares every frame against the first. The union of what moves is the
 * animation; anything constant (a table panel, a caption, the white surround)
 * never enters the box.
 */
/**
 * Right edge of the first contiguous run of moving columns.
 *
 * The diagram and any table panel are separated by a gutter of pixels that
 * never change. Walking out from the leftmost movement until the gutter ends
 * the run isolates the diagram without a hand-picked crop box.
 */
function firstColumnRun(movingColumns, minX, maxX) {
	const GUTTER = 8;
	let gap = 0;
	for (let x = minX; x <= maxX; x += 1) {
		if (movingColumns[x]) {
			gap = 0;
			continue;
		}
		gap += 1;
		if (gap >= GUTTER) return x - gap;
	}
	return null;
}

function motionBounds(frames, width, height, channels, override) {
	const [first] = frames;
	const movingColumns = new Uint8Array(width);
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;

	for (let f = 1; f < frames.length; f += 1) {
		const cur = frames[f];
		for (let y = 0; y < height; y += 1) {
			for (let x = 0; x < width; x += 1) {
				const i = (y * width + x) * channels;
				const moved =
					Math.abs(cur[i] - first[i]) > MOTION_THRESHOLD ||
					Math.abs(cur[i + 1] - first[i + 1]) > MOTION_THRESHOLD ||
					Math.abs(cur[i + 2] - first[i + 2]) > MOTION_THRESHOLD;
				if (!moved) continue;
				movingColumns[x] = 1;
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}
		}
	}

	if (maxX < 0) return null;

	/*
	 * The table panels animate too — their numbers change every frame — so raw
	 * motion bounds swallow them. The diagram and the table are separated by a
	 * clear gutter of untouched pixels, so take the first contiguous run of
	 * moving columns and stop at the gutter. Diagram first, table discarded.
	 */
	if (override.bottom !== undefined) maxY = Math.min(maxY, override.bottom);

	if (override.right !== undefined) {
		maxX = Math.min(maxX, override.right);
	} else {
		const firstRun = firstColumnRun(movingColumns, minX, maxX);
		if (firstRun) maxX = firstRun;
	}

	/*
	 * Crop to what actually moves, padded. Deliberately NOT squared: several of
	 * these diagrams are tall and narrow, and expanding them to a square reaches
	 * back across the gutter and pulls the table panel in again. The crop stays
	 * truthful to the drawing; the page gives it a square box and lets it sit
	 * inside with object-fit.
	 */
	const left = Math.max(0, minX - PAD);
	const top = Math.max(0, minY - PAD);
	return {
		left,
		top,
		width: Math.min(maxX + PAD, width - 1) - left + 1,
		height: Math.min(maxY + PAD, height - 1) - top + 1
	};
}

async function extract(name) {
	const path = join(SRC, name);
	const meta = await sharp(path, { animated: true }).metadata();
	const frameCount = meta.pages ?? 1;
	const width = meta.width ?? 0;
	const height = meta.pageHeight ?? meta.height ?? 0;

	/*
	 * Animated input decodes as one tall strip of pages, so each frame is a
	 * fixed-height band rather than a separate image.
	 */
	/*
	 * Channel count comes from the decoder, not from an assumption — these GIFs
	 * carry a transparency index, so they arrive as RGBA. Reading them as RGB
	 * shears every row by one byte per pixel and the frames come out as noise.
	 */
	const { data: strip, info } = await sharp(path, { animated: true })
		.raw()
		.toBuffer({ resolveWithObject: true });
	const channels = info.channels;
	const bytesPerFrame = width * height * channels;
	const frames = Array.from({ length: frameCount }, (_, i) =>
		strip.subarray(i * bytesPerFrame, (i + 1) * bytesPerFrame)
	);

	const stem = name.replace(/\.(gif|jpg)$/, "");
	const crop = motionBounds(frames, width, height, channels, {
		right: RIGHT_EDGE[stem],
		bottom: BOTTOM_EDGE[stem]
	}) ?? {
		left: 0,
		top: 0,
		width,
		height
	};

	const dir = join(OUT, stem);
	await mkdir(dir, { recursive: true });

	for (let i = 0; i < frameCount; i += 1) {
		await sharp(frames[i], { raw: { width, height, channels } })
			.extract(crop)
			.flatten({ background: "#ffffff" })
			.webp({ quality: 92 })
			.toFile(join(dir, `${i}.webp`));
	}

	return { name: stem, frames: frameCount, source: { width, height }, crop };
}

const files = (await readdir(SRC)).filter((f) => f.endsWith(".gif")).sort();
const manifest = [];

for (const f of files) {
	const entry = await extract(f);
	manifest.push(entry);
	console.log(
		`${entry.name}: ${entry.frames} frames, ${entry.source.width}x${entry.source.height} -> ${entry.crop.width}x${entry.crop.height} at ${entry.crop.left},${entry.crop.top}`
	);
}

await writeFile(join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, "\t")}\n`);
console.log(`\n${manifest.length} animations, manifest written to ${OUT}/manifest.json`);
