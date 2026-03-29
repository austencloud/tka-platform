/**
 * Deterministic 2D simplex noise.
 *
 * Based on Stefan Gustavson's simplex noise (public domain, 2012).
 * Adapted to TypeScript with pre-allocated gradient tables and zero
 * heap allocation per call — safe to call per-tip per-frame at 60fps.
 *
 * Returns a value in [-1, 1] for any (x, y) input pair.
 * The output is entirely determined by the input — no internal state,
 * no random seeds, same values every run.
 */

// Fixed permutation table (Ken Perlin's original 256-entry table).
// Doubled to avoid a modulo on every lookup.
const PERM = new Uint8Array(512);
const PERM_MOD12 = new Uint8Array(512);

const BASE_PERM: readonly number[] = [
  151, 160, 137,  91,  90,  15, 131,  13, 201,  95,  96,  53, 194, 233,   7, 225,
  140,  36, 103,  30,  69, 142,   8,  99,  37, 240,  21,  10,  23, 190,   6, 148,
  247, 120, 234,  75,   0,  26, 197,  62,  94, 252, 219, 203, 117,  35,  11,  32,
   57, 177,  33,  88, 237, 149,  56,  87, 174,  20, 125, 136, 171, 168,  68, 175,
   74, 165,  71, 134, 139,  48,  27, 166,  77, 146, 158, 231,  83, 111, 229, 122,
   60, 211, 133, 230, 220, 105,  92,  41,  55,  46, 245,  40, 244, 102, 143,  54,
   65,  25,  63, 161,   1, 216,  80,  73, 209,  76, 132, 187, 208,  89,  18, 169,
  200, 196, 135, 130, 116, 188, 159,  86, 164, 100, 109, 198, 173, 186,   3,  64,
   52, 217, 226, 250, 124, 123,   5, 202,  38, 147, 118, 126, 255,  82,  85, 212,
  207, 206,  59, 227,  47,  16,  58,  17, 182, 189,  28,  42, 223, 183, 170, 213,
  119, 248, 152,   2,  44, 154, 163,  70, 221, 153, 101, 155, 167,  43, 172,   9,
  129,  22,  39, 253,  19,  98, 108, 110,  79, 113, 224, 232, 178, 185, 112, 104,
  218, 246,  97, 228, 251,  34, 242, 193, 238, 210, 144,  12, 191, 179, 162, 241,
   81,  51, 145, 235, 249,  14, 239, 107,  49, 192, 214,  31, 181, 199, 106, 157,
  184,  84, 204, 176, 115, 121,  50,  45, 127,   4, 150, 254, 138, 236, 205,  93,
  222, 114,  67,  29,  24,  72, 243, 141, 128, 195,  78,  66, 215,  61, 156, 180,
];

for (let i = 0; i < 256; i++) {
  const v = BASE_PERM[i];
  PERM[i] = v;
  PERM[i + 256] = v;
  PERM_MOD12[i] = v % 12;
  PERM_MOD12[i + 256] = v % 12;
}

// 2D gradient vectors (12 directions for uniform coverage).
// Stored flat as [gx0, gy0, gx1, gy1, ...] to avoid object allocation.
const GRAD2 = new Float32Array([
   1,  1,  -1,  1,   1, -1,  -1, -1,
   1,  0,  -1,  0,   1,  0,  -1,  0,
   0,  1,   0, -1,   0,  1,   0, -1,
]);

/** Dot product of gradient[gi] with (x, y), fetched from the flat table. */
function dot2(gi: number, x: number, y: number): number {
  const base = gi * 2;
  return GRAD2[base] * x + GRAD2[base + 1] * y;
}

// Skew / unskew factors for 2D simplex.
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

/**
 * 2D simplex noise.
 *
 * Deterministic: same (x, y) always returns the same value.
 * Zero-allocation: no objects created during evaluation.
 * Range: [-1, 1].
 */
export function simplex2d(x: number, y: number): number {
  // Skew input to find which simplex cell we're in.
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);

  // Unskew back to find the cell origin in (x, y) space.
  const t = (i + j) * G2;
  const x0 = x - (i - t);
  const y0 = y - (j - t);

  // Determine which triangle we're in (upper or lower).
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;

  // Offsets for the two remaining corners.
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  // Hashed gradient indices — use bitwise AND 255 instead of modulo.
  const ii = i & 255;
  const jj = j & 255;
  const gi0 = PERM_MOD12[ii      + PERM[jj     ]];
  const gi1 = PERM_MOD12[ii + i1 + PERM[jj + j1]];
  const gi2 = PERM_MOD12[ii +  1 + PERM[jj +  1]];

  // Contribution from corner 0.
  let n0 = 0;
  const t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    const t0sq = t0 * t0;
    n0 = t0sq * t0sq * dot2(gi0, x0, y0);
  }

  // Contribution from corner 1.
  let n1 = 0;
  const t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    const t1sq = t1 * t1;
    n1 = t1sq * t1sq * dot2(gi1, x1, y1);
  }

  // Contribution from corner 2.
  let n2 = 0;
  const t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    const t2sq = t2 * t2;
    n2 = t2sq * t2sq * dot2(gi2, x2, y2);
  }

  // Scale to [-1, 1]. The factor 70 comes from Gustavson's analysis.
  return 70 * (n0 + n1 + n2);
}
