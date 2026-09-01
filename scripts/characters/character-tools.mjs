import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIRECTORY, "../..");
const CONVERTER_SCRIPT = resolve(
  PROJECT_ROOT,
  "scripts/avatar-bakeoff/convert-candidate.py"
);
const THUMBNAIL_SCRIPT = resolve(
  PROJECT_ROOT,
  "scripts/render-avatar-thumbnails.py"
);

export function resolveBlenderBinary(environment = process.env) {
  const candidates = [
    environment.BLENDER_BIN,
    "C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe",
    "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe",
    "C:\\Program Files\\Blender Foundation\\Blender 4.4\\blender.exe",
    "/Applications/Blender.app/Contents/MacOS/Blender",
    "/usr/bin/blender",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function normalizeCharacterSource({
  source,
  destination,
  blenderBinary,
}) {
  if (extname(source).toLowerCase() === ".glb") {
    copyFileSync(source, destination);
    return;
  }
  execFileSync(
    blenderBinary,
    ["--background", "--python", CONVERTER_SCRIPT, "--", source, destination],
    { stdio: "inherit" }
  );
}

export async function renderCharacterThumbnail({
  id,
  optimizedPath,
  thumbnailPath,
  temporaryDirectory,
  blenderBinary,
}) {
  const inputDirectory = resolve(temporaryDirectory, "thumbnail-input");
  const pngDirectory = resolve(temporaryDirectory, "thumbnail-png");
  mkdirSync(inputDirectory, { recursive: true });
  mkdirSync(pngDirectory, { recursive: true });
  copyFileSync(optimizedPath, resolve(inputDirectory, `${id}.glb`));
  execFileSync(
    blenderBinary,
    [
      "--background",
      "--python",
      THUMBNAIL_SCRIPT,
      "--",
      "--input",
      inputDirectory,
      "--output",
      pngDirectory,
      "--size",
      "512",
    ],
    { stdio: "inherit" }
  );

  const pngPath = resolve(pngDirectory, `${id}.png`);
  if (!existsSync(pngPath)) {
    throw new Error("Blender completed without producing a character portrait");
  }
  mkdirSync(dirname(thumbnailPath), { recursive: true });
  await sharp(pngPath)
    .resize(256, 256, { fit: "cover", position: "top" })
    .webp({ quality: 88 })
    .toFile(thumbnailPath);
}

export { PROJECT_ROOT };
