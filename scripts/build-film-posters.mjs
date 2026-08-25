#!/usr/bin/env node
/**
 * Bake one poster per library film in `src/routes/test/film-director/_films`.
 *
 * A saved film captures its own poster from whatever the user was looking at
 * when they hit Save. A library film has no document to keep one in, so its
 * frame is baked here from the `poster` cue on its registry entry and committed
 * under `static/films/posters/`.
 *
 * Why a bake rather than rendering on the marquee: a poster costs a full WebGL
 * boot — Threlte, avatar GLBs, an environment, effect presets — and the marquee
 * would pay five of them just to let someone choose a film.
 *
 * Usage (dev server on :5173 must be up; Chrome from
 * scripts/launch-chrome-debug.ps1 must be listening on 9222):
 *
 *   node scripts/build-film-posters.mjs
 *   node scripts/build-film-posters.mjs --only star
 *   node scripts/build-film-posters.mjs --raw     # also keep the source PNGs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import sharp from "sharp";

import {
  capture,
  delay,
  evaluate,
  isDebugChromeRunning,
  navigate,
  openTab,
  setViewport,
  waitFor,
} from "./lib/chrome-cdp.mjs";

const ORIGIN = process.env.FILM_POSTER_ORIGIN ?? "https://localhost:5173";
const ROUTE = "/test/film-director";
const OUTPUT_DIR = resolve("static/films/posters");

/** 16:9, and the same short side as the marquee card at its widest tier. */
const POSTER_WIDTH = 960;
const POSTER_HEIGHT = 540;
const POSTER_QUALITY = 82;
const POSTER_MAX_BYTES = 220 * 1024;

/** The capture viewport. 16:9 so the canvas clip needs no crop. */
const VIEWPORT = { width: 1920, height: 1080, dpr: 1 };

/** How long the scene gets to settle after a seek before the shutter opens. */
const SETTLE_MS = 1400;

const only = readFlagValue("--only");
const keepRaw = process.argv.includes("--raw");

function readFlagValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

/**
 * Hide every element that is not the canvas or one of its ancestors.
 *
 * The stage chrome — back button, performer rail, transport — floats over the
 * canvas, and the screenshot takes whatever Chrome presented.
 *
 * A stylesheet rather than a pass of inline styles: Svelte replaces transport
 * nodes as the playhead settles, and a replacement node carries no inline style
 * of its own. A rule keeps hiding whatever appears next. Inline `!important` on
 * the spine outranks the sheet, and `visibility` rather than `display` so
 * nothing relayouts the canvas mid-capture.
 */
const HIDE_CHROME = `(() => {
  const canvas = document.querySelector("[data-film-director-workbench] canvas");
  if (!canvas) return false;
  const sheet = document.createElement("style");
  sheet.textContent = "body * { visibility: hidden !important; }";
  document.head.append(sheet);
  for (let node = canvas; node && node !== document.documentElement; node = node.parentElement) {
    node.style.setProperty("visibility", "visible", "important");
  }
  return true;
})()`;

/** Resolve the scene-relative cue against the film the page actually loaded. */
const readCueTime = (sceneId, offsetSeconds) => `(() => {
  const scenes = window.__filmDirector.film.scenes;
  const index = scenes.findIndex((scene) => scene.id === ${JSON.stringify(sceneId)});
  if (index < 0) {
    return { error: "no scene " + ${JSON.stringify(sceneId)} + "; film has " + scenes.map((s) => s.id).join(", ") };
  }
  const scene = scenes[index];
  if (${offsetSeconds} < 0 || ${offsetSeconds} >= scene.durationSeconds) {
    return { error: "offset ${offsetSeconds}s is outside " + scene.id + " (" + scene.durationSeconds + "s)" };
  }
  return { index, seconds: scene.startSeconds + ${offsetSeconds} };
})()`;

async function capturePoster(page, cue) {
  await navigate(page, `${ORIGIN}${ROUTE}?film=${encodeURIComponent(cue.key)}`);
  await setViewport(page, VIEWPORT);

  await waitFor(page, "Boolean(window.__filmDirector)", {
    label: `${cue.key}: director seam`,
  });
  await waitFor(page, "window.__filmDirector.preparation.complete", {
    timeoutMs: 180000,
    label: `${cue.key}: film preparation`,
  });

  const cueTime = await evaluate(page, readCueTime(cue.sceneId, cue.offsetSeconds));
  if (cueTime.error) throw new Error(`${cue.key}: ${cueTime.error}`);

  await evaluate(
    page,
    `(() => {
      window.__filmDirector.pause();
      window.__filmDirector.seek(${cueTime.seconds});
    })()`
  );
  await waitFor(
    page,
    `window.__filmDirector.sceneReady
      && !window.__filmDirector.transitionHolding
      && window.__filmDirector.frame.sceneIndex === ${cueTime.index}`,
    { label: `${cue.key}: scene ${cue.sceneId} ready` }
  );

  await delay(SETTLE_MS);
  if (!(await evaluate(page, HIDE_CHROME))) {
    throw new Error(`${cue.key}: the stage rendered no canvas`);
  }
  // Two frames after the chrome is hidden: one to lay it out, one to present.
  await evaluate(
    page,
    `new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))`
  );

  // Unclipped: the stage is fixed to the whole viewport, so with the chrome
  // hidden the viewport is the canvas, and no clip rectangle has to survive
  // the browser's zoom level.
  return capture(page, keepRaw ? resolve(OUTPUT_DIR, `${cue.key}.raw.png`) : null);
}

/**
 * Reject a frame that captured nothing.
 *
 * A WebGL canvas that lost its context, or one screenshotted before the first
 * present, comes back uniformly black or transparent — a file that looks like a
 * successful bake until someone opens the marquee.
 */
async function assertNotBlank(key, buffer) {
  const stats = await sharp(buffer).stats();
  const brightest = Math.max(...stats.channels.slice(0, 3).map((c) => c.max));
  const spread = Math.max(...stats.channels.slice(0, 3).map((c) => c.stdev));
  if (brightest < 12 || spread < 2) {
    throw new Error(
      `${key}: captured a blank frame (max channel ${brightest}, stdev ${spread.toFixed(2)})`
    );
  }
}

async function encodePoster(key, png) {
  const webp = await sharp(png)
    .resize(POSTER_WIDTH, POSTER_HEIGHT, { fit: "cover", position: "centre" })
    .toColorspace("srgb")
    .webp({ quality: POSTER_QUALITY, effort: 5 })
    .toBuffer();
  if (webp.byteLength > POSTER_MAX_BYTES) {
    throw new Error(
      `${key}: poster is ${(webp.byteLength / 1024).toFixed(0)}KB, over the ${POSTER_MAX_BYTES / 1024}KB budget`
    );
  }
  const path = resolve(OUTPUT_DIR, `${key}.webp`);
  writeFileSync(path, webp);
  return { path, bytes: webp.byteLength };
}

async function main() {
  if (!(await isDebugChromeRunning())) {
    throw new Error(
      "Debug Chrome is not on 9222. Start it with:\n" +
        "  pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank"
    );
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const page = await openTab(`${ORIGIN}${ROUTE}`);
  const failures = [];
  try {
    await setViewport(page, VIEWPORT);
    await waitFor(page, "document.readyState === 'complete'", {
      label: "marquee load",
    });
    const cues = await waitFor(page, "window.__filmPosterCues", {
      label: "poster cues from the film registry",
    });
    const wanted = only ? cues.filter((cue) => cue.key === only) : cues;
    if (wanted.length === 0) {
      throw new Error(
        `--only ${only} matches no film. Known: ${cues.map((cue) => cue.key).join(", ")}`
      );
    }

    for (const cue of wanted) {
      process.stdout.write(`${cue.key}: ${cue.sceneId} +${cue.offsetSeconds}s ... `);
      try {
        const png = await capturePoster(page, cue);
        await assertNotBlank(cue.key, png);
        const { path, bytes } = await encodePoster(cue.key, png);
        console.log(`${(bytes / 1024).toFixed(0)}KB -> ${path}`);
      } catch (error) {
        console.log("FAILED");
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
  } finally {
    await page.close();
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`  ${failure}`);
    process.exitCode = 1;
  }
}

await main();
