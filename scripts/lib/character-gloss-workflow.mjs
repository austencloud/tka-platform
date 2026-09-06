import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

/**
 * Resolve `@gltf-transform/core` through the CLI the rest of the pipeline
 * shells out to, so both halves stay on one version (see
 * `character-alpha-modes.mjs`).
 */
const require = createRequire(import.meta.url);
const fromCli = createRequire(require.resolve("@gltf-transform/cli"));

function moduleUrl(specifier) {
  return pathToFileURL(fromCli.resolve(specifier)).href;
}

async function loadGltfTransform() {
  const [core, extensions] = await Promise.all([
    import(moduleUrl("@gltf-transform/core")),
    import(moduleUrl("@gltf-transform/extensions")),
  ]);
  return { core, extensions };
}

/**
 * Mixamo's non-PBR characters ship a specular/glossiness texture set. Blender
 * imports the glossiness sheet as the Principled roughness input without
 * inverting it and hands the FBX reflection factor to metallic, so the glTF
 * export carries a metallic-roughness texture whose green channel is still
 * glossiness (dark cloth reads as mirror-smooth) and whose blue channel is
 * saturated, multiplied by a 0.5 metallic factor. A cotton sweater then renders
 * as half-metal latex. The sheet keeps its source name, which is how this pass
 * recognises it.
 */
export const GLOSSINESS_IMAGE_PATTERN = /gloss/i;

/** WebP quality used by the rest of the optimizer. */
const WEBP_QUALITY = 85;

export function isGlossinessImageName(name) {
  return typeof name === "string" && GLOSSINESS_IMAGE_PATTERN.test(name);
}

/**
 * Rewrite interleaved raw pixels in place: glossiness becomes roughness (green
 * inverted) and the metallic channel (blue) is cleared. Skin, hair and cloth
 * are dielectrics; a character that really carries metal ships a proper
 * metallic-roughness sheet and never reaches this pass.
 */
export function convertGlossToRoughness(raw, channels) {
  if (channels < 3) throw new Error("Expected at least three channels");
  for (let i = 0; i + 2 < raw.length; i += channels) {
    raw[i + 1] = 255 - raw[i + 1];
    raw[i + 2] = 0;
  }
  return raw;
}

async function reencode(texture, cache) {
  if (cache.has(texture)) return cache.get(texture);
  const image = texture.getImage();
  if (!image) {
    cache.set(texture, false);
    return false;
  }
  const { data, info } = await sharp(Buffer.from(image))
    .raw()
    .toBuffer({ resolveWithObject: true });
  convertGlossToRoughness(data, info.channels);
  const pipeline = sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  });
  const mimeType = texture.getMimeType();
  const encoded =
    mimeType === "image/png"
      ? await pipeline.png().toBuffer()
      : mimeType === "image/jpeg"
        ? await pipeline.jpeg({ quality: WEBP_QUALITY }).toBuffer()
        : await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
  texture.setImage(new Uint8Array(encoded));
  cache.set(texture, true);
  return true;
}

/**
 * Convert a specular/glossiness export to metallic-roughness in place. Returns
 * one entry per material changed; a file without a glossiness sheet is left
 * untouched and returns an empty list.
 */
export async function normalizeCharacterGlossWorkflow(file) {
  const { core, extensions } = await loadGltfTransform();
  const io = new core.NodeIO().registerExtensions(extensions.ALL_EXTENSIONS);
  const document = await io.read(file);
  const materials = document.getRoot().listMaterials();

  const glossTextures = new Set();
  for (const material of materials) {
    const texture = material.getMetallicRoughnessTexture();
    if (!texture) continue;
    if (isGlossinessImageName(texture.getName() || texture.getURI())) {
      glossTextures.add(texture);
    }
  }
  if (glossTextures.size === 0) return [];

  const cache = new Map();
  for (const texture of glossTextures) await reencode(texture, cache);

  const changed = [];
  for (const material of materials) {
    const texture = material.getMetallicRoughnessTexture();
    const converted = texture ? glossTextures.has(texture) : false;
    const metallicFactor = material.getMetallicFactor();
    if (!converted && metallicFactor === 0) continue;
    material.setMetallicFactor(0);
    changed.push({
      material: material.getName(),
      glossinessConverted: converted,
      metallicFactor: { from: metallicFactor, to: 0 },
    });
  }

  await io.write(file, document);
  return changed;
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: character-gloss-workflow.mjs <file.glb>");
    process.exit(1);
  }
  const changed = await normalizeCharacterGlossWorkflow(file);
  process.stdout.write(JSON.stringify(changed));
}
