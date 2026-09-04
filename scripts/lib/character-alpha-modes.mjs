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

/** Alpha at or above this survives an alpha test at the glTF default cutoff. */
export const ALPHA_CUTOFF_BYTE = 128;

/**
 * The share of sampled texels that may sit strictly between transparent and
 * opaque before the alpha channel counts as a gradient rather than a mask.
 */
const CUTOUT_PARTIAL_FRACTION = 0.02;

/**
 * A triangle whose UVs roam this far outside the unit square is not being
 * measured; it is tiling. Coverage is reported as unmeasured rather than
 * guessed, and an unmeasured material is left exactly as the artist declared it.
 */
const MAX_UV_TILES = 4;

/**
 * Decide what alpha mode a set of sampled alpha bytes actually needs.
 *
 * The question a material can answer about itself is not "does my texture have
 * an alpha channel" but "does anything I draw sample a texel that is not
 * opaque". Those differ whenever several materials share one atlas, which is
 * the entire cause of the defect this pass exists to fix.
 */
export function classifySampledAlpha(samples, cutoffByte = ALPHA_CUTOFF_BYTE) {
  let opaque = 0;
  let clear = 0;
  let belowCutoff = 0;
  let min = 255;
  for (let i = 0; i < samples.length; i += 1) {
    const a = samples[i];
    if (a === 255) opaque += 1;
    else if (a === 0) clear += 1;
    if (a < cutoffByte) belowCutoff += 1;
    if (a < min) min = a;
  }
  const total = samples.length;
  if (total === 0) {
    return {
      sampled: 0,
      minAlpha: null,
      fractionBelowCutoff: null,
      partialFraction: null,
      mode: null,
    };
  }
  const partialFraction = (total - opaque - clear) / total;
  const fractionBelowCutoff = belowCutoff / total;

  // Nothing this material draws is even close to transparent. OPAQUE, not
  // MASK: an alpha test that can never discard anything is pure cost, and a
  // minified mip texel near a UV island border averages in whatever else the
  // atlas packed next door, which is how an alpha test starts eating a
  // silhouette that measured solid at level zero.
  if (fractionBelowCutoff === 0 && partialFraction <= CUTOUT_PARTIAL_FRACTION) {
    return {
      sampled: total,
      minAlpha: min,
      fractionBelowCutoff,
      partialFraction,
      mode: "OPAQUE",
    };
  }

  // Two-valued alpha is a cutout. It needs the test, but it does not need the
  // transparent pass or the loss of depth writes that comes with it.
  if (partialFraction <= CUTOUT_PARTIAL_FRACTION) {
    return {
      sampled: total,
      minAlpha: min,
      fractionBelowCutoff,
      partialFraction,
      mode: "MASK",
    };
  }

  // Real intermediate coverage. Whatever the artist declared, leave it.
  return {
    sampled: total,
    minAlpha: min,
    fractionBelowCutoff,
    partialFraction,
    mode: null,
  };
}

async function decodeAlpha(texture, cache) {
  if (cache.has(texture)) return cache.get(texture);
  const image = texture.getImage();
  if (!image) {
    cache.set(texture, null);
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
  const decoded = { alpha, width: info.width, height: info.height };
  cache.set(texture, decoded);
  return decoded;
}

/**
 * Mark every texel the given primitives' UV triangles cover.
 *
 * Returns null when any triangle tiles far enough outside the unit square that
 * a bounded rasterization would be a guess.
 */
function rasterizeCoverage(primitives, width, height) {
  const covered = new Uint8Array(width * height);
  for (const primitive of primitives) {
    const uv = primitive.getAttribute("TEXCOORD_0");
    if (!uv) return null;
    const indices = primitive.getIndices();
    const count = indices ? indices.getCount() : uv.getCount();
    const corner = (i) =>
      uv.getElement(indices ? indices.getScalar(i) : i, [0, 0]);

    for (let i = 0; i + 2 < count; i += 3) {
      const a = corner(i);
      const b = corner(i + 1);
      const c = corner(i + 2);
      if (
        Math.max(a[0], b[0], c[0]) - Math.min(a[0], b[0], c[0]) > MAX_UV_TILES ||
        Math.max(a[1], b[1], c[1]) - Math.min(a[1], b[1], c[1]) > MAX_UV_TILES
      ) {
        return null;
      }

      const ax = a[0] * width;
      const ay = a[1] * height;
      const bx = b[0] * width;
      const by = b[1] * height;
      const cx = c[0] * width;
      const cy = c[1] * height;
      const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (area === 0) continue;

      const minX = Math.floor(Math.min(ax, bx, cx));
      const maxX = Math.ceil(Math.max(ax, bx, cx));
      const minY = Math.floor(Math.min(ay, by, cy));
      const maxY = Math.ceil(Math.max(ay, by, cy));

      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 = ((bx - ax) * (py - ay) - (px - ax) * (by - ay)) / area;
          const w1 = ((px - ax) * (cy - ay) - (cx - ax) * (py - ay)) / area;
          if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue;
          // Samplers repeat, so a UV outside the unit square lands back inside
          // the sheet rather than off the edge of it.
          const wx = ((x % width) + width) % width;
          const wy = ((y % height) + height) % height;
          covered[wy * width + wx] = 1;
        }
      }
    }
  }
  return covered;
}

function primitivesByMaterial(document) {
  const byMaterial = new Map();
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial();
      if (!material) continue;
      const existing = byMaterial.get(material);
      if (existing) existing.push(primitive);
      else byMaterial.set(material, [primitive]);
    }
  }
  return byMaterial;
}

/**
 * Measure one material against the texels its own geometry samples.
 *
 * Exported so a check can reproduce the pipeline's reasoning on a shipped file
 * instead of trusting the declaration in it.
 */
export async function measureMaterialAlpha(material, primitives, cache) {
  const texture = material.getBaseColorTexture();
  if (!texture) {
    // The only alpha was the base-colour factor, which the caller has read.
    return { sampled: null, minAlpha: null, mode: "OPAQUE", measured: true };
  }
  // A texture transform rewrites UVs on the GPU. Rasterizing the raw ones
  // would measure the wrong region, so decline to measure instead.
  if (texture.getExtension?.("KHR_texture_transform")) {
    return { sampled: null, minAlpha: null, mode: null, measured: false };
  }

  // An existing MASK is judged against its own cutoff, not the glTF default:
  // the question is whether that material's alpha test can ever discard, and
  // only its own threshold answers it.
  const cutoffByte =
    material.getAlphaMode() === "MASK"
      ? Math.round(material.getAlphaCutoff() * 255)
      : ALPHA_CUTOFF_BYTE;

  const decoded = await decodeAlpha(texture, cache);
  if (!decoded) return { sampled: null, minAlpha: null, mode: null, measured: false };

  const covered = rasterizeCoverage(primitives, decoded.width, decoded.height);
  if (!covered) return { sampled: null, minAlpha: null, mode: null, measured: false };

  let n = 0;
  for (let i = 0; i < covered.length; i += 1) if (covered[i]) n += 1;
  const samples = new Uint8Array(n);
  for (let i = 0, k = 0; i < covered.length; i += 1) {
    if (covered[i]) samples[k++] = decoded.alpha[i];
  }
  return { ...classifySampledAlpha(samples, cutoffByte), measured: true };
}

/**
 * Correct materials that were exported as blends without needing to be.
 *
 * Ch01 and Ch12 declare their body material `BLEND`. Both pack hair and body
 * into a single texture, so the sheet carries an alpha channel and the exporter
 * marked every material sampling it transparent - including the one that draws
 * skin, shirt, jeans and shoes. glTF `BLEND` makes three.js render in the
 * transparent pass with depth writes off, so a solid body sorts against itself
 * per object: the far arm shows through the near shoulder, and which surface
 * wins changes with the camera.
 *
 * The fix is not a heuristic about the sheet. Every body mesh on all twelve
 * characters samples nothing but fully opaque texels - measured by rasterizing
 * their own UV triangles - so those materials are `OPAQUE`, which is what the
 * ten correctly exported characters already say. A material whose geometry
 * really does sample a two-valued cutout becomes `MASK`; one with genuine
 * partial coverage, and one whose base colour is already translucent, keep the
 * declaration they arrived with.
 */
export async function normalizeCharacterAlphaModes(file) {
  const { core, extensions } = await loadGltfTransform();
  const io = new core.NodeIO().registerExtensions(extensions.ALL_EXTENSIONS);
  const document = await io.read(file);

  const byMaterial = primitivesByMaterial(document);
  const cache = new Map();
  const changed = [];

  for (const material of document.getRoot().listMaterials()) {
    const from = material.getAlphaMode();
    // A MASK whose alpha test can never discard is the same defect wearing a
    // quieter hat, so both non-opaque declarations are candidates.
    if (from !== "BLEND" && from !== "MASK") continue;
    // A hair card sitting at baseColorFactor alpha 0 is making a statement
    // about itself that this pass has no business overruling.
    if (material.getAlpha() !== 1) continue;

    const primitives = byMaterial.get(material) ?? [];
    if (primitives.length === 0) continue;

    const measurement = await measureMaterialAlpha(material, primitives, cache);
    if (!measurement.measured || !measurement.mode) continue;

    if (measurement.mode === from) continue;
    if (measurement.mode === "OPAQUE") material.setAlphaMode("OPAQUE");
    else material.setAlphaMode("MASK").setAlphaCutoff(0.5);

    changed.push({
      material: material.getName(),
      from,
      to: measurement.mode,
      sampledTexels: measurement.sampled,
      minAlpha: measurement.minAlpha,
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
  const byMaterial = primitivesByMaterial(document);
  const cache = new Map();

  const rows = [];
  for (const material of document.getRoot().listMaterials()) {
    const primitives = byMaterial.get(material) ?? [];
    const measurement =
      primitives.length > 0
        ? await measureMaterialAlpha(material, primitives, cache)
        : { sampled: null, minAlpha: null, mode: null, measured: false };
    rows.push({
      name: material.getName(),
      alphaMode: material.getAlphaMode(),
      alphaCutoff: material.getAlphaCutoff(),
      baseColorAlpha: material.getAlpha(),
      hasBaseColorTexture: material.getBaseColorTexture() !== null,
      meshes: primitives.length,
      sampledTexels: measurement.sampled,
      minSampledAlpha: measurement.minAlpha,
      neededMode: measurement.mode,
    });
  }
  return rows;
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
