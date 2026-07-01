// pixelmatch ships no type declarations (package.json has no "types"/"exports").
// Minimal ambient declaration matching the v6 signature so the visual-parity
// harness (src/routes/test/step-migration-parity) type-checks. Follows the
// same pattern as page-flip.d.ts / chip-toggle-augment.d.ts.
declare module "pixelmatch" {
  interface PixelmatchOptions {
    threshold?: number;
    includeAA?: boolean;
    alpha?: number;
    aaColor?: [number, number, number];
    diffColor?: [number, number, number];
    diffColorAlt?: [number, number, number];
    diffMask?: boolean;
  }
  export default function pixelmatch(
    img1: Uint8Array | Uint8ClampedArray,
    img2: Uint8Array | Uint8ClampedArray,
    output: Uint8Array | Uint8ClampedArray | null,
    width: number,
    height: number,
    options?: PixelmatchOptions
  ): number;
}
