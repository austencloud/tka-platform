#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const manifestPath = resolve(
  process.env.TKA_PLANT_BRIDGE_MANIFEST ??
    "scripts/forest-plantcatalog-bridge.json"
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const requestedJobs = process.argv
  .filter((argument) => argument.startsWith("--job="))
  .map((argument) => argument.slice("--job=".length));
const selectedIds =
  requestedJobs.length > 0
    ? requestedJobs
    : manifest.exportSets[manifest.activeExportSet];
const jobsById = new Map(manifest.jobs.map((job) => [job.id, job]));
const jobs = selectedIds.map((id) => {
  const job = jobsById.get(id);
  if (!job) throw new Error(`Unknown plant bridge job: ${id}`);
  return job;
});
const evidence = resolve(manifest.paths.evidenceRoot);
const views = [
  ["front", "Front"],
  ["three-quarter", "Three-quarter"],
  ["silhouette", "Silhouette"],
  ["human-height", "Human height"],
  ["bark-close", "Bark / root"],
  ["canopy", "Canopy"],
];
const panel = 360;
const rail = 210;
const header = 100;
const width = rail + panel * views.length;
const height = header + panel * jobs.length;
const composites = [];
for (let row = 0; row < jobs.length; row += 1) {
  const job = jobs[row];
  for (let column = 0; column < views.length; column += 1) {
    const [view] = views[column];
    const image = await sharp(resolve(evidence, `${job.id}-${view}.png`))
      .resize(panel, panel, { fit: "cover" })
      .png()
      .toBuffer();
    composites.push({
      input: image,
      left: rail + column * panel,
      top: header + row * panel,
    });
  }
}
const viewLabels = views
  .map(
    ([, label], index) =>
      `<text x="${rail + index * panel + panel / 2}" y="70" text-anchor="middle" fill="#c9d6cc" font-family="system-ui, sans-serif" font-size="22">${label}</text>`
  )
  .join("\n");
const speciesLabels = jobs
  .map((job, index) => {
    const disposition = job.proofDisposition?.toUpperCase();
    const label = `${job.label ?? job.species}${disposition ? ` · ${disposition}` : ""}`;
    const fill = job.proofDisposition === "rejected" ? "#ff8a82" : "#f3eadc";
    return `<text x="${rail / 2}" y="${header + index * panel + panel / 2}" text-anchor="middle" fill="${fill}" font-family="system-ui, sans-serif" font-size="18" font-weight="700" transform="rotate(-90 ${rail / 2} ${header + index * panel + panel / 2})">${label}</text>`;
  })
  .join("\n");
const overlay = Buffer.from(
  `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="#101817"/><text x="28" y="40" fill="#f3eadc" font-family="system-ui, sans-serif" font-size="30" font-weight="700">${manifest.proofTitle ?? "PlantCatalog Bridge R1 · deterministic proof"}</text>${viewLabels}${speciesLabels}</svg>`
);
const output = resolve(
  evidence,
  manifest.proofArtifacts?.contactSheetFilename ??
    "plantcatalog-bridge-contact-sheet.png"
);
await sharp({ create: { width, height, channels: 4, background: "#101817" } })
  .composite([{ input: overlay, left: 0, top: 0 }, ...composites])
  .png()
  .toFile(output);
console.log(output);
