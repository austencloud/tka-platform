#!/usr/bin/env node
/** Capture the Seraphic Vault Gate 4 still and motion evidence from debug Chrome. */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The CDP client moved to scripts/lib/chrome-cdp.mjs when a third consumer
// appeared. Re-exported here so gate5 and any other caller keep working.
export { capture, connect, delay } from "./lib/chrome-cdp.mjs";
import { capture, connect, delay } from "./lib/chrome-cdp.mjs";

const DEBUG_ENDPOINT = "http://127.0.0.1:9222/json/list";
const TARGET_URL = "https://127.0.0.1:5175/test/celestial-scene?view=hero";
const EVIDENCE_DIR = resolve("docs/superpowers/specs/seraphic-vault");
const FRAME_DIR = resolve(
  process.env.TEMP ?? ".",
  "seraphic-vault-gate4-frames"
);
const STILL_PATH = resolve(EVIDENCE_DIR, "seraphic-vault-gate4-desktop.png");
const MOTION_PATH = resolve(
  EVIDENCE_DIR,
  "seraphic-vault-gate4-interaction-capture.gif"
);
const stillOnly = process.argv.includes("--still-only");

async function main() {
  const targets = await fetch(DEBUG_ENDPOINT).then((response) =>
    response.json()
  );
  const target = targets.find(
    (candidate) => candidate.type === "page" && candidate.url === TARGET_URL
  );
  if (!target) {
    throw new Error(`Debug Chrome target is not open: ${TARGET_URL}`);
  }

  mkdirSync(EVIDENCE_DIR, { recursive: true });
  rmSync(FRAME_DIR, { recursive: true, force: true });
  mkdirSync(FRAME_DIR, { recursive: true });

  const client = await connect(target.webSocketDebuggerUrl);
  try {
    await client.send("Page.bringToFront");
    await capture(client, STILL_PATH);

    for (let frame = 0; !stillOnly && frame < 24; frame += 1) {
      const framePath = resolve(
        FRAME_DIR,
        `frame_${String(frame).padStart(3, "0")}.png`
      );
      await capture(client, framePath);
      await delay(375);
    }
  } finally {
    client.close();
  }

  if (!stillOnly) {
    execFileSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-framerate",
        "8",
        "-i",
        resolve(FRAME_DIR, "frame_%03d.png"),
        "-filter_complex",
        "[0:v]fps=8,scale=960:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5[v]",
        "-map",
        "[v]",
        "-loop",
        "0",
        MOTION_PATH,
      ],
      { stdio: "inherit" }
    );
  }

  rmSync(FRAME_DIR, { recursive: true, force: true });
  console.log(`Still: ${STILL_PATH}`);
  if (!stillOnly) console.log(`Motion: ${MOTION_PATH}`);
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
