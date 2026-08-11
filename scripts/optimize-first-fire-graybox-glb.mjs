#!/usr/bin/env node
/** Optimize the Blender-authored First Fire Cinder Court for web delivery.
 *
 * Compression is two-stage rather than one `optimize --compress draco`, because
 * that path gives no control over quantization and its default of 14 bits for
 * POSITION moves vertices by up to ~3.8mm across this 61.6m block. That was
 * enough to collapse 552 triangles to zero area and to open hairline reads at
 * doorway edges. 16 bits puts the error at ~0.94mm and leaves 153.
 *
 * The script then audits ITS OWN OUTPUT. Auditing the .blend and shipping a
 * requantized copy proves something about a file nobody loads; the shipped
 * bytes are the ones the visitor walks into, so the gate belongs here.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const input = resolve("artifacts/first-fire-cinder-court-raw.glb");
const output = resolve(
  "static/models/museum/cave/first-fire-cinder-court-graybox.glb"
);
const staged = resolve("artifacts/first-fire-cinder-court/graybox-staged.glb");
const uncompressed = resolve(
  "artifacts/first-fire-cinder-court/graybox-uncompressed.glb"
);
const auditReport = resolve(
  "artifacts/first-fire-cinder-court/shipped-glb-audit.json"
);
const blender =
  process.env.BLENDER ??
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe";
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

if (!existsSync(input)) {
  console.error(`Input not found: ${input}`);
  console.error("Run the Blender graybox export first.");
  process.exit(1);
}

mkdirSync(dirname(output), { recursive: true });
mkdirSync(dirname(staged), { recursive: true });

function run(label, command, args) {
  console.log(`\n${label}`);
  execSync(
    [command, ...args].map((part) => `"${part.replaceAll('"', '\\"')}"`).join(" "),
    { stdio: "inherit" }
  );
}

const transform = (args) => run(args[0], pnpm, ["exec", "gltf-transform", ...args]);

transform([
  "optimize",
  input,
  uncompressed,
  "--compress",
  "false",
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
transform([
  "draco",
  uncompressed,
  staged,
  "--quantize-position",
  "16",
  "--quantize-normal",
  "12",
]);
transform(["validate", staged]);

// The shell has to survive being looked at AFTER compression, not before. Any
// non-zero exit here leaves the previously shipped GLB in place.
run("Audit the compressed shell", blender, [
  "--background",
  "--python",
  resolve("scripts/audit-first-fire-shell.py"),
  "--",
  "--source",
  staged,
  "--json",
  auditReport,
]);

run("Publish", "node", [
  "-e",
  `require('fs').copyFileSync(${JSON.stringify(staged)}, ${JSON.stringify(output)})`,
]);
rmSync(staged, { force: true });
rmSync(uncompressed, { force: true });

console.log(
  `\nFirst Fire Cinder Court graybox: ${output} (${(statSync(output).size / 1024).toFixed(1)} KB)`
);
