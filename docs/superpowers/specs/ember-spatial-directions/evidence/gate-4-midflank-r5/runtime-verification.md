# Ember R5 runtime implementation

Engineering evidence, 2026-09-05. This is the running application, not the Gate 3 paintover. Authorization: museum decision `HyW3fFQVRHU3Uc0ezeWO`; evidence reference `GLYjYdoqw6cDfzcLAGiq`.

## Delivered

- The approved terrain remains unchanged. The production Blender file retains the original scientific lava mesh; delivery smooths shared lava top corners without changing the boundary footprint. The build report records the precise differences and source hashes.
- The original cooled bench is the performance surface. Its contact shading blends into the surrounding slope. Increasing the cast does not create the old circular platform.
- Static talus, pressure-rib rubble and lava clinker are baked in Blender. Runtime adds surface detail, atmosphere and restrained animated heat to the authored lava mesh.
- Both viewer backends consume the same optimized 4,071,744-byte GLB. R10 remains available as a versioned rollback asset.
- No Meshy credits were spent. The added rock scan is CC0; provenance is in `static/textures/ember-midflank-r5/README.md`.

## Verification

| Check                    | Evidence / result                                                                                                                                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused regression tests | Six suites: 38 passed, one existing historical TODO. Covers actual optimized asset loading, native ground datum, preserved geometry, platform suppression, reduced-motion time, material ownership/disposal, shared adapters and worker protocol/slot behavior.                                 |
| Full project type check  | `npm run check`: zero errors and zero warnings.                                                                                                                                                                                                                                                 |
| Browser rendering        | Live worker backend reached idle; legacy backend also rendered the shared asset. No shader or runtime errors observed after the implementation fixes.                                                                                                                                           |
| Playback and cast        | Play/Pause exercised. Four performers rendered on the bench; see `runtime-four-performers.png`.                                                                                                                                                                                                 |
| Re-entry                 | Scene controls switched Ember to Cosmic and back. All four performers remained; one worker remained after cleanup. Return took 829 ms, maximum main-thread gap 20.8 ms. See `scene-reentry.json` and transition captures.                                                                       |
| Reduced motion           | Browser media emulation confirmed the preference before a fresh worker boot. Actual-asset test verifies the environment's time uniform stays at zero. See `runtime-reduced-motion.png`.                                                                                                         |
| Orbit                    | Eight 45-degree bearings rendered at the registered 25 m radius; `ember-r5-runtime-orbit-board.png`. Native desktop captures avoid emulated screenshot artifacts.                                                                                                                               |
| Viewports                | Seven CSS sizes from 375x667 through 3840x2160: ready worker and no horizontal document overflow. After correcting capture-surface scaling, all seven fresh-load layouts were visually inspected in `ember-r5-runtime-viewport-board.png`; measurements are in `viewport-capture-metrics.json`. |

Focused command:

```text
npx vitest run --config tests/config/vitest.config.ts tests/unit/3d-worker-renderer/ember-environment-world-parity.test.ts tests/unit/3d-viewer/ember-ground-detail.test.ts tests/unit/3d-worker-renderer/ember-shared-adapter-contract.test.ts tests/unit/3d/ember-production-slice-contract.test.ts tests/unit/3d-worker-renderer/worker-renderer-slot.test.ts tests/unit/3d-worker-renderer/worker-renderer-protocol.test.ts
```

## Remaining acceptance gaps

1. Cold boot is not consistently within the 50 ms input-gap budget. A native desktop boot took about 1.95 s with a 59.3 ms maximum main-thread gap; other captured runs also exceeded the threshold. Frame and worker-count gates passed. Warm re-entry passed all three gates. This is not a claim of steady-state FPS, cross-device performance, or hitch-free loading.
2. Standing audience pockets remain reserved in the terrain, but the optional shared audience renderer still uses its existing seated characters. No standing crowd is claimed in the runtime images.
3. Initial emulated screenshot surfaces tiled or cropped their content. Those invalid captures were discarded. The final seven-size sweep uses fresh renderer loads with each emulated screen scaled to fit the browser surface. Black capture margins are retained and labeled; these prove layout and composition, not native-resolution pixel quality or live-resize behavior. Separate native desktop and mobile captures are also included.
4. Reduced-motion preference reaches a worker at initialization and environment switching. A preference change while the same environment remains mounted requires reload or a scene switch.
5. The terrain, lighting and materials are implemented, but the runtime surface is visibly simpler than the illustrative paintover. Final human art acceptance remains open; this report does not promote agent inspection into user approval.

Gate 3 is approved by the user's explicit request to proceed. Gate 4 stays in progress with the performance gap recorded as failed; Gates 5/6 are not presented as accepted. Engineering integration does not erase these creative and verification gaps.

## Reproduce and inspect

Build the native source with Blender's background mode and `scripts/build-ember-production-slice.py -- --midflank-r5`, then run `node scripts/optimize-ember-production-slice.mjs --midflank-r5`.

Open `/test/viewer-3d?scene=ember&renderer=worker` for the gated worker renderer; omit `renderer=worker` for the streaming legacy workbench. The default camera comes from the approved R5 camera contract. Camera URLs support `cam=x,y,z&look=x,y,z&fov=50`.
