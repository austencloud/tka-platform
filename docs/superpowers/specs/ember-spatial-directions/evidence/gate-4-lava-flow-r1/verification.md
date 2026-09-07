# Lava bank and flow correction

User authority: CFmmTJ8PS6cLgVDu5l8V (2026-09-05). This is a focused Gate 4 correction, not a new mountain or stage design, and not final visual acceptance.

## Change

The 2,400 rendered cell tops are now one welded, subdivided surface with rounded banks meeting the existing terrain. Cell walls and the fixed channel clinker are removed. The original scientific deposit remains hidden in the native source. Terrain and bench geometry hashes are unchanged (see build-report.json).

240 thin crust rafts travel downstream along nine sampled paths at approximately 0.62–0.77 m/s, with small turns and bobbing. A bank-weighted surface wave and downstream shader coordinates supply independent liquid motion. This is an authored visual approximation, not a fluid simulation. Banks remain fixed and reduced-motion mode freezes the animation.

The optimized GLB is 2,691,252 bytes, down from 4,071,744. Crust uses one additional instanced draw. The isolated shared-world browser harness reports 11 draws; that is not a full-viewer performance benchmark.

## Evidence

- `flow-close.png`: reported camera, actual shared-world browser render.
- `flow-motion.webm`: six seconds of continuous runtime motion, same camera; no compositing or accelerated playback.
- `build-report.json`: geometry preservation, final source digest and surface counts.
- Ten focused tests pass, including actual optimized GLB coordinates, raft size and movement, reduced-motion freezing, disposal and worker/legacy world parity.
- Full Svelte check: zero errors and warnings. Focused production TypeScript lint passed.
- Opposite-bank camera inspected directly in the browser; continuous flank and cooled bench retained.

The earlier Gate 4 cold-boot input-gap failure remains unresolved and recorded in the existing performance report. No broader gate is advanced. No Meshy credits were spent.

## Reproduce

Run Blender 5.0 in background mode with `scripts/build-ember-lava-flow.py`, then run `node scripts/optimize-ember-production-slice.mjs --lava-flow`. The native source is `blender/ember-midflank-lava-flow-r1.blend`; the canonical and versioned optimized GLBs contain identical bytes. The previous R5 GLB remains available for rollback.

The development-only harness is `tests/manual/ember-lava-flow.html`, served through Vite's filesystem route. It uses the production shared world without performers. Final app inspection must use `/test/viewer-3d?scene=ember&renderer=worker` and the legacy renderer, not this harness as a substitute.
