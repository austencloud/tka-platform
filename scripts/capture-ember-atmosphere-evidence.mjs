#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import {
  capture,
  delay,
  evaluate,
  navigate,
  openTab,
  setViewport,
} from "./lib/chrome-cdp.mjs";

const origin = process.env.EMBER_CAPTURE_ORIGIN ?? "http://127.0.0.1:5176";
const evidenceDir = resolve(
  "docs/superpowers/specs/ember-spatial-directions/evidence/gate-4-atmosphere-r1"
);

const heroCamera = {
  position: [0, 3.4, -9.8],
  target: [0, 1.4, 5.2],
  fov: 50,
};

const looks = ["blackglass-inferno", "furnace-storm", "sulfur-caldera"];

const orbits = [
  ["front", [0, 3.4, -9.8], [0, 1.4, 5.2]],
  ["front-right", [8.8, 3.8, -6.5], [0, 1.5, 4]],
  ["right", [13.5, 4.1, 2.5], [0, 1.5, 3]],
  ["rear-right", [9, 4.1, 12], [0, 1.5, 2]],
  ["rear", [0, 4.1, 15], [0, 1.5, 1]],
  ["rear-left", [-9, 4.1, 12], [0, 1.5, 2]],
  ["left", [-13.5, 4.1, 2.5], [0, 1.5, 3]],
  ["front-left", [-8.8, 3.8, -6.5], [0, 1.5, 4]],
];

const viewports = [
  ["4k-200", 1920, 1080],
  ["4k-150", 2560, 1440],
  ["4k-100", 3840, 2160],
  ["laptop", 1440, 900],
  ["tablet", 820, 1180],
  ["fold-landscape", 960, 412],
  ["iphone-se", 375, 667],
];

function tuple(value) {
  return value.map((number) => Number(number).toFixed(3)).join(",");
}

function viewerUrl(look, camera) {
  const url = new URL("/test/viewer-3d", origin);
  url.searchParams.set("scene", "ember");
  url.searchParams.set("emberLook", look);
  url.searchParams.set("cam", tuple(camera.position));
  url.searchParams.set("look", tuple(camera.target));
  url.searchParams.set("fov", String(camera.fov));
  return url.href;
}

function repositoryPath(path) {
  return relative(process.cwd(), path).replaceAll("\\", "/");
}

async function settle(client, milliseconds = 4500) {
  await delay(milliseconds);
  const state = await evaluate(
    client,
    `({
      ready: document.readyState,
      canvas: Boolean(document.querySelector("canvas")),
      overlay: Boolean(document.querySelector("vite-error-overlay"))
    })`
  );
  if (state.ready !== "complete" || !state.canvas || state.overlay) {
    throw new Error(
      `Ember capture surface did not settle: ${JSON.stringify(state)}`
    );
  }
}

async function captureFrame(client, path, look, camera, settleMs = 4500) {
  await navigate(client, viewerUrl(look, camera));
  await settle(client, settleMs);
  await capture(client, path);
}

mkdirSync(evidenceDir, { recursive: true });

const client = await openTab(viewerUrl("blackglass-inferno", heroCamera));
const report = {
  capturedAt: new Date().toISOString(),
  selectedLook: "blackglass-inferno",
  museumTrackerItem: "sDKmB6cUEXLfHgz4DGd4",
  geometryRevision: "ember-volcanic-world-production-slice-r7",
  origin,
  lookAudition: [],
  orbit: [],
  viewports: [],
  performance: null,
};

try {
  await setViewport(client, { width: 1920, height: 1080, dpr: 1 });
  for (const look of looks) {
    const path = resolve(evidenceDir, `look-${look}-hero-1920x1080.png`);
    await captureFrame(client, path, look, heroCamera, 5000);
    report.lookAudition.push({ look, path: repositoryPath(path) });
  }

  for (const [name, position, target] of orbits) {
    const path = resolve(evidenceDir, `orbit-${name}-1920x1080.png`);
    await captureFrame(
      client,
      path,
      "blackglass-inferno",
      { position, target, fov: 50 },
      3500
    );
    report.orbit.push({
      name,
      position,
      target,
      path: repositoryPath(path),
    });
  }

  for (const [name, width, height] of viewports) {
    await setViewport(client, { width, height, dpr: 1 });
    const path = resolve(
      evidenceDir,
      `viewport-${name}-${width}x${height}.png`
    );
    await captureFrame(client, path, "blackglass-inferno", heroCamera, 2500);
    report.viewports.push({
      name,
      width,
      height,
      path: repositoryPath(path),
    });
  }

  await setViewport(client, { width: 1920, height: 1080, dpr: 1 });
  await navigate(client, viewerUrl("blackglass-inferno", heroCamera));
  await settle(client, 4000);
  report.performance = await evaluate(
    client,
    `new Promise((resolve) => {
      const samples = [];
      let previous = performance.now();
      function frame(now) {
        samples.push(now - previous);
        previous = now;
        if (samples.length < 180) requestAnimationFrame(frame);
        else {
          samples.sort((a, b) => a - b);
          const averageMs = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
          resolve({
            samples: samples.length,
            averageFrameMs: averageMs,
            averageFps: 1000 / averageMs,
            p95FrameMs: samples[Math.floor(samples.length * 0.95)],
            canvas: (() => {
              const canvas = document.querySelector("canvas");
              return canvas ? { width: canvas.width, height: canvas.height } : null;
            })()
          });
        }
      }
      requestAnimationFrame(frame);
    })`
  );
} finally {
  writeFileSync(
    resolve(evidenceDir, "ember-atmosphere-runtime-report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  await client.close();
}

console.log(`Ember atmosphere evidence: ${evidenceDir}`);
