# Downstream direction and bank correction

2026-09-05. Corrects the reversed thermal motion and rounded rectangular bank identified by Austen after R1. No mountain, performance-bench, atmosphere, or renderer redesign.

## Root cause and correction

Blender exports glTF V as `1 - V`. R1 authored `V = -Z`, so exported V increased uphill; the shader's `V - speed*time` moved the thermal pattern and waves opposite the crust. R2 authors `V = Z`, producing exported `V = 1 - Z`, which increases downhill. Both existing shader advection terms now move with the rafts. No renderer-specific correction is needed.

The delivered-GLB regression test measures world metres per V. It failed on R1 at +1.0000095 and passes on R2 at approximately -1. The shader speed of +0.72 V/s therefore moves toward negative world Z, agreeing with the actual raft movement assertion. Tests ran with the repository's explicit jsdom configuration: ten passed, including reduced-motion freezing and world parity.

## Bank geometry

The builder relaxes the coarse connected footprint before subdivision, then adds restrained irregular deformation to the whole surface. This removes the softened grid-step appearance without detaching the bank from the terrain. Maximum coarse footprint displacement is 2.969 m. Terrain and hidden scientific-reference hashes remain unchanged. See `build-report.json` for native-source digest and counts.

## Direct browser evidence

At camera `-23.985,0.688,-7.051`, look `0,0.688,0`, FOV 50:

- `motion-start.png` and `motion-end.png` show the same camera at 36.43 and 42.56 simulation seconds. Bright surface features and crust both move down-left; the bank remains fixed.
- `downstream-motion.webm` is six seconds of continuous actual runtime capture, not generated imagery or accelerated playback.
- The stepped protrusion is replaced by a shallower, irregular contour. No shader errors or warnings were observed in the corrected shared-world preview.
- The shared-world harness uses the production asset and material owner; it is not a substitute for the final full-viewer check.

The optimized asset is 2,748,032 bytes. R1 and R5 versioned assets remain available. Build with Blender 5.0 using `scripts/build-ember-lava-flow.py`, then `node scripts/optimize-ember-production-slice.mjs --lava-flow`.

Gate 4 remains in progress; the earlier cold-boot performance failure is not resolved or waived by this focused correction.
