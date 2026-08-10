#!/usr/bin/env node
/** Prepare the approved ImageGen cloud panorama for the celestial sky dome. */

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const input = process.argv[2];
if (!input) {
  throw new Error(
    "Pass the generated panorama source path as the first argument"
  );
}

const output = resolve(
  "static/textures/celestial/seraphic-cloud-panorama.webp"
);
const source = resolve(input);

await sharp(source)
  .resize(2048, 1024, { fit: "cover", position: "centre" })
  .webp({ quality: 88, effort: 6, smartSubsample: true })
  .toFile(output);

const [sourceBuffer, outputBuffer, outputStat, metadata] = await Promise.all([
  readFile(source),
  readFile(output),
  stat(output),
  sharp(output).metadata(),
]);

console.log(
  JSON.stringify(
    {
      source,
      sourceSha256: createHash("sha256").update(sourceBuffer).digest("hex"),
      output,
      outputSha256: createHash("sha256").update(outputBuffer).digest("hex"),
      bytes: outputStat.size,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    },
    null,
    2
  )
);
