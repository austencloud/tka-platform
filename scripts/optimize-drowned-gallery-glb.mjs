#!/usr/bin/env node
/** Optimize the Blender-authored Drowned Gallery graybox for web delivery. */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const input = resolve("artifacts/drowned-gallery-graybox_raw.glb");
const output = resolve(
  "static/models/museum/cave/drowned-gallery-graybox.glb"
);
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

if (!existsSync(input)) {
  console.error(`Input not found: ${input}`);
  console.error("Run the Blender graybox export first.");
  process.exit(1);
}

mkdirSync(dirname(output), { recursive: true });

function run(label, args) {
  console.log(`\n${label}`);
  const command = [pnpm, "exec", "gltf-transform", ...args]
    .map((part) => `"${part.replaceAll('"', '\\"')}"`)
    .join(" ");
  execSync(command, {
    stdio: "inherit",
  });
}

run("Optimize Drowned Gallery graybox", [
  "optimize",
  input,
  output,
  "--compress",
  "draco",
  "--simplify",
  "false",
  "--instance",
  "true",
  "--flatten",
  "false",
  "--join",
  "false",
  "--palette",
  "false",
  "--texture-compress",
  "false",
]);
// Stamp the sequence-parity metadata the Blender exporter drops (it does not
// export scene custom properties): performer/sequence ids + the layout digest,
// as glTF asset extras. Runtime automatons stay authoritative; this is the
// audit trail tying the GLB to its exact layout and live loops.
{
  const { readFileSync, writeFileSync } = await import("node:fs");
  const manifest = JSON.parse(
    readFileSync(
      resolve("docs/superpowers/specs/2026-08-09-drowned-gallery-blender-plan.json"),
      "utf8"
    )
  );
  const glb = readFileSync(output);
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
  json.asset.extras = {
    ...(json.asset.extras ?? {}),
    drownedGallerySourceDigest: manifest.sourceDigest,
    drownedGalleryPerformers: manifest.contract.performers,
  };
  let jsonBuffer = Buffer.from(JSON.stringify(json), "utf8");
  const pad = (4 - (jsonBuffer.length % 4)) % 4;
  if (pad) jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(pad, 0x20)]);
  const rest = glb.subarray(20 + jsonLength); // remaining chunks (BIN)
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); // glTF magic
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + jsonBuffer.length + rest.length, 8);
  header.writeUInt32LE(jsonBuffer.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16); // JSON chunk type
  writeFileSync(output, Buffer.concat([header, jsonBuffer, rest]));
  console.log("Stamped sequence-parity extras into the GLB.");
}

run("Validate optimized GLB", ["validate", output]);
run("Inspect optimized GLB", ["inspect", output]);

console.log(
  `\nDrowned Gallery graybox: ${output} (${(statSync(output).size / 1024).toFixed(1)} KB)`
);
