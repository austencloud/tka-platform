/**
 * Optimize the chXX Mixamo full-body avatar GLBs for web delivery.
 *
 * These raw Mixamo exports are 16-124 MB each (2048² PNG textures, uncompressed
 * geometry) and are gitignored / never deployed, so their local paths 404. This
 * script produces R2-ready optimized GLBs.
 *
 * Pipeline (skinning-safe — NO weld/simplify/join, which corrupt skin weights,
 * and NO Draco, because the avatar loader (AvatarSkeletonBuilder) uses a bare
 * GLTFLoader with no DRACOLoader; WebP is decoded natively by three):
 *   resize 1024 → WebP(q85) → resample anim → prune → dedup
 *
 * Output: static/models/avatars/_optimized/chXX.glb
 * Then upload to R2 tka-assets under models/avatars/chXX.glb.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, mkdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";

const SRC_DIR = "static/models/avatars";
const OUT_DIR = join(SRC_DIR, "_optimized");
const TMP = "static/models/avatars/_tmp";

const AVATARS = readdirSync(SRC_DIR)
  .filter((f) => /^ch\d+\.glb$/.test(f))
  .sort();

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(TMP, { recursive: true });

const gt = (args) =>
  execFileSync("npx", ["gltf-transform", ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

const mb = (p) => (statSync(p).size / 1024 / 1024).toFixed(2);

for (const file of AVATARS) {
  const src = join(SRC_DIR, file);
  const out = join(OUT_DIR, file);
  const a = join(TMP, "a.glb");
  const b = join(TMP, "b.glb");
  const c = join(TMP, "c.glb");
  const d = join(TMP, "d.glb");
  try {
    gt(["resize", src, a, "--width", "1024", "--height", "1024"]);
    gt(["webp", a, b, "--quality", "85"]);
    gt(["resample", b, c]);
    gt(["prune", c, d]);
    gt(["dedup", d, out]);
    console.log(`${file}: ${mb(src)} MB -> ${mb(out)} MB`);
  } catch (err) {
    console.error(`${file}: FAILED`, err.stderr?.toString() ?? err.message);
  }
}

rmSync(TMP, { recursive: true, force: true });
console.log("Done. Optimized GLBs in", OUT_DIR);
