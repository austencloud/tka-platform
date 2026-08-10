#!/usr/bin/env node
/** Capture the Seraphic Vault Gate 5 still, camera, and transition evidence. */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { capture, connect, delay } from "./capture-seraphic-vault-gate4.mjs";

const DEBUG_ENDPOINT = "http://127.0.0.1:9222/json/list";
const TARGET_URL =
  "https://localhost:5173/test/celestial-scene?view=hero&controls=1";
const EVIDENCE_DIR = resolve("docs/superpowers/specs/seraphic-vault");
const FRAME_ROOT = resolve(
  process.env.TEMP ?? ".",
  "seraphic-vault-gate5-frames"
);
const STILL_PATH = resolve(EVIDENCE_DIR, "seraphic-vault-gate5-desktop.png");
const WALK_PATH = resolve(
  EVIDENCE_DIR,
  "seraphic-vault-gate5-integrated-camera-sweep.gif"
);
const TRANSITION_PATH = resolve(
  EVIDENCE_DIR,
  "seraphic-vault-gate5-transition-captures.gif"
);

async function evaluate(client, expression) {
  const { result } = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.subtype === "error") throw new Error(result.description);
  return result.value;
}

async function clickButton(client, label) {
  const clicked = await evaluate(
    client,
    `(() => {
      const button = [...document.querySelectorAll("button")].find(
        (candidate) => candidate.textContent?.trim() === ${JSON.stringify(label)}
      );
      if (!button) return false;
      button.click();
      return true;
    })()`
  );
  if (!clicked) throw new Error(`Review control not found: ${label}`);
}

function makeGif(frameDirectory, frameRate, outputPath) {
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-framerate",
      String(frameRate),
      "-i",
      resolve(frameDirectory, "frame_%03d.png"),
      "-filter_complex",
      `[0:v]fps=${frameRate},scale=960:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5[v]`,
      "-map",
      "[v]",
      "-loop",
      "0",
      outputPath,
    ],
    { stdio: "inherit" }
  );
}

async function captureSequence(
  client,
  frameDirectory,
  frameCount,
  frameDelay,
  cues
) {
  mkdirSync(frameDirectory, { recursive: true });
  for (let frame = 0; frame < frameCount; frame += 1) {
    const cue = cues.get(frame);
    if (cue) await clickButton(client, cue);
    await capture(
      client,
      resolve(frameDirectory, `frame_${String(frame).padStart(3, "0")}.png`)
    );
    await delay(frameDelay);
  }
}

const targets = await fetch(DEBUG_ENDPOINT).then((response) => response.json());
const target = targets.find(
  (candidate) => candidate.type === "page" && candidate.url === TARGET_URL
);
if (!target) {
  throw new Error(`Debug Chrome target is not open: ${TARGET_URL}`);
}

mkdirSync(EVIDENCE_DIR, { recursive: true });
rmSync(FRAME_ROOT, { recursive: true, force: true });

const client = await connect(target.webSocketDebuggerUrl);
try {
  await clickButton(client, "Seraph");
  await clickButton(client, "Hero");
  await delay(1200);

  await evaluate(
    client,
    `document.querySelector(".review-controls")?.style.setProperty("display", "none")`
  );
  await capture(client, STILL_PATH);
  await evaluate(
    client,
    `document.querySelector(".review-controls")?.style.removeProperty("display")`
  );

  const walkFrames = resolve(FRAME_ROOT, "walk");
  await captureSequence(
    client,
    walkFrames,
    40,
    200,
    new Map([
      [0, "Hero"],
      [8, "Aisle"],
      [16, "Stage"],
      [24, "Profile"],
      [32, "Hero"],
    ])
  );
  makeGif(walkFrames, 4, WALK_PATH);

  const transitionFrames = resolve(FRAME_ROOT, "transitions");
  await captureSequence(
    client,
    transitionFrames,
    40,
    100,
    new Map([
      [0, "Seraph"],
      [8, "Cosmic"],
      [16, "Seraph"],
      [24, "Ocean"],
      [32, "Seraph"],
    ])
  );
  makeGif(transitionFrames, 8, TRANSITION_PATH);
} finally {
  client.close();
  rmSync(FRAME_ROOT, { recursive: true, force: true });
}

console.log(`Still: ${STILL_PATH}`);
console.log(`Camera sweep: ${WALK_PATH}`);
console.log(`Transitions: ${TRANSITION_PATH}`);
