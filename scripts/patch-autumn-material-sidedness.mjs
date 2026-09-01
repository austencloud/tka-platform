#!/usr/bin/env node

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  AUTUMN_FRONT_SIDE_MATERIAL_PREFIXES,
  isAutumnFrontSideMaterial,
} from "./autumn-material-sidedness.mjs";

const target = resolve(
  process.argv[2] ?? "static/models/autumn/autumn-environment.glb"
);
const temporary = `${target}.sidedness.tmp`;
const source = readFileSync(target);
if (source.readUInt32LE(0) !== 0x46546c67 || source.readUInt32LE(4) !== 2) {
  throw new Error(`${target} is not a glTF 2 GLB`);
}

const originalJsonLength = source.readUInt32LE(12);
const json = JSON.parse(
  source.subarray(20, 20 + originalJsonLength).toString("utf8")
);
const matchedPrefixes = new Set();
for (const material of json.materials ?? []) {
  const name = material.name ?? "";
  if (!isAutumnFrontSideMaterial(name)) continue;
  material.doubleSided = false;
  for (const prefix of AUTUMN_FRONT_SIDE_MATERIAL_PREFIXES) {
    if (name.startsWith(prefix)) matchedPrefixes.add(prefix);
  }
}

const missing = AUTUMN_FRONT_SIDE_MATERIAL_PREFIXES.filter(
  (prefix) => !matchedPrefixes.has(prefix)
);
if (missing.length > 0) {
  throw new Error(`Missing Autumn material prefixes: ${missing.join(", ")}`);
}

const encodedJson = Buffer.from(JSON.stringify(json));
const paddedJsonLength = Math.ceil(encodedJson.length / 4) * 4;
const paddedJson = Buffer.alloc(paddedJsonLength, 0x20);
encodedJson.copy(paddedJson);
const remainingChunks = source.subarray(20 + originalJsonLength);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + paddedJsonLength + remainingChunks.length, 8);
header.writeUInt32LE(paddedJsonLength, 12);
header.writeUInt32LE(0x4e4f534a, 16);

writeFileSync(temporary, Buffer.concat([header, paddedJson, remainingChunks]));
renameSync(temporary, target);
console.log(
  `Front-sided ${matchedPrefixes.size} closed Autumn material families in ${target}`
);
