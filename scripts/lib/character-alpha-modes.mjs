import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

/**
 * `@gltf-transform/core` is not a direct dependency; the CLI owns it, and the
 * CLI is what every other step in this pipeline shells out to. Resolving core
 * through the CLI keeps both halves on one version instead of letting a second
 * declared range drift away from the binary that does the rest of the work.
 */
const require = createRequire(import.meta.url);
const fromCli = createRequire(require.resolve("@gltf-transform/cli"));

/** Windows absolute paths are not importable; the ESM loader wants a URL. */
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
 * The share of a base-colour texture that must be fully opaque before its
 * alpha channel counts as a cutout mask rather than a blend.
 *
 * Measured, not guessed. Ch01's body atlas is 98.56% fully opaque, 0.91% fully
 * transparent and 0.53% in between; Ch12's is 96.00 / 2.38 / 1.62. Nothing in
 * either is a gradient - the alpha is there because the artist packed hair into
 * the same sheet as the skin and clothing.
 */
const CUTOUT_OPAQUE_FRACTION = 0.95;

/** The share that may sit strictly between transparent and opaque. */
const CUTOUT_PARTIAL_FRACTION = 0.02;

/** Alpha at or above this counts as opaque once the mode becomes MASK. */
const CUTOUT_ALPHA_CUTOFF = 0.5;

/**
 * Classify one decoded alpha channel.
 *
 * A blend needs intermediate values to blend with. A mask does not, and a mask
 * declared as a blend is what breaks these characters: glTF `BLEND` makes
 * three.js render the material in the transparent pass with depth writes off,
 * so a solid body sorts against itself per object and you see the far arm
 * through the near shoulder.
 */
export function classifyAlphaChannel(alpha) {
  let opaque = 0;
  let clear = 0;
  for (let i = 0; i < alpha.length; i += 1) {
    const a = alpha[i];
    if (a === 255) opaque += 1;
    else if (a === 0) clear += 1;
  }
  const total = alpha.length || 1;
  const opaqueFraction = opaque / total;
  const clearFraction = clear / total;
  const partialFraction = 1 - opaqueFraction - clearFraction;
  return {
    opaqueFraction,
    clearFraction,
    partialFraction,
    isCutout:
      opaqueFraction >= CUTOUT_OPAQUE_FRACTION &&
      partialFraction <= CUTOUT_PARTIAL_FRACTION,
  };
}

async function alphaStatsForTexture(texture, cache) {
  const key = texture;
  if (cache.has(key)) return cache.get(key);
  const image = texture.getImage();
  if (!image) {
    cache.set(key, null);
    return null;
  }
  const { data, info } = await sharp(Buffer.from(image))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const stride = info.channels;
  const alpha = new Uint8Array(info.width * info.height);
  for (let i = 0, a = stride - 1; i < alpha.length; i += 1, a += stride) {
    alpha[i] = data[a];
  }
  const stats = classifyAlphaChannel(alpha);
  cache.set(key, stats);
  return stats;
}

/**
 * Demote cutout materials that were exported as blends.
 *
 * Two of the twelve shipped characters, Ch01 and Ch12, declare their body
 * material `BLEND`. Both pack hair and body into a single texture, so the sheet
 * carries an alpha channel and the exporter marked every material that samples
 * it as transparent - including the one that draws the skin, shirt, jeans and
 * shoes. The other ten characters keep hair on its own sheet and their bodies
 * came out `OPAQUE`.
 *
 * A fully opaque base colour over a cutout mask never needed blending, so this
 * moves it to `MASK`, which is what glTF has for exactly this case. Depth
 * writes come back and the character stops sorting against itself. Materials
 * whose base colour is already translucent are left alone: a hair card at
 * `baseColorFactor` alpha 0 is making a statement about itself that this pass
 * has no business overruling.
 */
export async function normalizeCharacterAlphaModes(file) {
  const { core, extensions } = await loadGltfTransform();
  const io = new core.NodeIO().registerExtensions(extensions.ALL_EXTENSIONS);
  const document = await io.read(file);

  const cache = new Map();
  const changed = [];

  for (const material of document.getRoot().listMaterials()) {
    if (material.getAlphaMode() !== "BLEND") continue;
    if (material.getAlpha() !== 1) continue;

    const texture = material.getBaseColorTexture();
    const stats = texture ? await alphaStatsForTexture(texture, cache) : null;

    // No base-colour texture means the only alpha was the factor, and that is
    // already known to be 1.
    if (texture && !stats?.isCutout) continue;

    material.setAlphaMode("MASK").setAlphaCutoff(CUTOUT_ALPHA_CUTOFF);
    changed.push({
      material: material.getName(),
      opaqueFraction: stats?.opaqueFraction ?? 1,
      partialFraction: stats?.partialFraction ?? 0,
    });
  }

  if (changed.length > 0) await io.write(file, document);
  return changed;
}

/**
 * Report every material's alpha declaration without changing anything.
 *
 * The pipeline corrects what it can prove; this is how a check confirms the
 * corrected file actually shipped that way.
 */
export async function readCharacterAlphaModes(file) {
  const { core, extensions } = await loadGltfTransform();
  const io = new core.NodeIO().registerExtensions(extensions.ALL_EXTENSIONS);
  const document = await io.read(file);

  return document
    .getRoot()
    .listMaterials()
    .map((material) => ({
      name: material.getName(),
      alphaMode: material.getAlphaMode(),
      alphaCutoff: material.getAlphaCutoff(),
      baseColorAlpha: material.getAlpha(),
      hasBaseColorTexture: material.getBaseColorTexture() !== null,
    }));
}

/**
 * Runnable as its own process so `optimizeCharacterGlb` can keep the
 * synchronous shape it shares with every gltf-transform CLI step.
 */
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: character-alpha-modes.mjs <file.glb>");
    process.exit(1);
  }
  const changed = await normalizeCharacterAlphaModes(file);
  process.stdout.write(JSON.stringify(changed));
}
