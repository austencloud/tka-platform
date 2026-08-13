# Olive Cloudbreak Revision 6 Handoff (2026-08-11)

## Mission

Olive Cloudbreak is the Celestial/Sun environment: a warm natural refuge above
the clouds rather than a religious caricature of heaven. Its active direction
is one broad limestone shelf, a protected dry performance terrace, two distinct
olive trees, one restrained right-edge lagoon, a worn route to a monumental
rear sanctuary, four distant floating mesas, thin waterfalls, and one distant
sun.

The governing direction is
[the Olive Cloudbreak pivot](active/2026-08-09-olive-cloudbreak-celestial-pivot.md),
the current production brief is
[Gate 1 Revision 6](seraphic-vault/seraphic-vault-gate1-r6-opus-production-pass.md),
and formal gate state lives in
[scene-gates.json](seraphic-vault/scene-gates.json).

Revision 6 is now integrated into the canonical Celestial runtime. The asset
bench and Gate 5 route mount the same scene owner rather than maintaining a
second review-only assembly.

## Completed and verified

### Canonical runtime integration

- `CelestialScene.svelte` mounts the shared `OliveCloudbreakSlice.svelte`.
- `OliveCloudbreakSlice.svelte` now composes the Revision 6 landmass, custom
  olives, selected CC0 geology, irregular reflective lagoon, shaped bank, dry
  stage, worn route, rear sanctuary study, four floating mesas, and animated
  waterfalls.
- The former route-local asset, lagoon-edge, spatial-study, and waterfall
  implementations moved into
  `src/lib/shared/3d/environments/scenes/celestial/`.
- The asset catalog is now a thin review shell over the same shared runtime
  owner. Its production asset entries inherit canonical paths, heights, and
  material treatment from `cloudbreak-assets.ts`.
- The old shell GLB remains only as the owner of the broad landmass and distant
  mesa geometry. It no longer owns the finished trees, shoreline, water, stage,
  or waterfalls.

### Sun and lighting

- The sun is one camera-centred sky sprite, not a duplicate mesh or a nearby
  ball inside the scene.
- Each frame places it at a fixed angular direction relative to the camera. Its
  apparent size derives from a `0.78` degree angular diameter, so translation
  does not produce parallax.
- The key light uses the same distant direction contract.
- `SkyGradient` no longer hides a second sun behind the panorama.

### Performer grounding and composition

- The approved stage top remains at local `0.225` metres.
- `getNativeStageSurfaceY(BackgroundType.CELESTIAL)` now returns `0.225`, so the
  environment moves beneath the canonical performer anchor instead of sinking
  performers into the terrace.
- The Gate 5 hero camera is offset laterally for ensemble review. This exposes
  the depth rows instead of collapsing eight performers into two overlapping
  silhouettes.
- In-app browser inspection confirmed grounded, readable solo, four-performer,
  and eight-performer arrangements.

### Automated evidence

The focused suite passed on 2026-08-11:

```text
pnpm exec vitest run --config tests/config/vitest.config.ts \
  tests/unit/3d-viewer/celestial-asset-catalog.test.ts \
  tests/unit/3d-viewer/olive-cloudbreak-production.test.ts \
  tests/unit/3d-viewer/performer-stage-bounds.test.ts \
  tests/unit/3d-viewer/seraphic-vault-cloudbreak.test.ts \
  tests/unit/3d/stage-coordinate-frame.test.ts

5 files passed, 41 tests passed
```

The gate manifest also passed:

```text
PASS: seraphic-vault gate manifest is valid
```

One allowed `pnpm check:fast -- --incremental` run reported the shared
repository baseline of 237 errors and 13 warnings. Its only Cloudbreak-specific
diagnostic was an unsafe JSON cast in `cloudbreak-layout.ts`; that cast was
corrected through `unknown`. The full checker was not run a second time because
the repository resource rule permits one full check per turn.

### Visual evidence

The canonical Gate 5 integration was inspected in the in-app browser at:

`https://127.0.0.1:5176/test/celestial-integration?performers=8`

- Solo: 60 FPS and 104 geometries at the observed frame.
- Four performers: 58 FPS and 158 geometries at the observed frame.
- Eight performers: 40 to 60 FPS and 223 to 229 geometries during the observed
  development-session frames.
- The stage remained visible, feet remained on its surface, all eight performers
  remained readable, and the two olives, lagoon, distant banks, waterfalls,
  clouds, and sky sun remained present.
- The composition was also inspected at 820 by 1180, 960 by 412, and 375 by 667.
  Controls remained usable and the performer group stayed visible.
- The browser console had zero warning or error entries during the integration
  and asset-bench passes.

These FPS readings are visual-session observations, not a controlled benchmark.

## Formal approval state

- Gate 1 remains `ready-for-review`. Integration does not silently convert it
  into an approval.
- Revision 6 tracker proposal `9hS7oQNdNlVwHLMUvB8R` remains unaccepted.
- Its provenance is accepted Revision 5 decision `IhLgSyXG6tHNsFSDhv3H`.
- Later gates remain pending because the asset-quality amendment reopened the
  production sequence.

## Current working-tree scope

The resume audit observed shared `main` at
`f395c24d2290175057b44c2236fd55a87da46a43`. Other agents may advance it after
this handoff. The checkout contains concurrent Forest, Winter, Autumn, sharing,
and Scene Composer changes. Do not revert or stage unrelated files.

Cloudbreak integration currently modifies:

- `scripts/seraphic-vault-cloudbreak-layout.json`
- `src/lib/shared/3d/environments/domain/models/scene-configs/celestial-scene-config.ts`
- `src/lib/shared/3d/environments/domain/stage-coordinate-frame.ts`
- `src/lib/shared/3d/environments/scenes/CelestialScene.svelte`
- `src/lib/shared/3d/environments/scenes/celestial/CelestialSun.svelte`
- `src/lib/shared/3d/environments/scenes/celestial/OliveCloudbreakSlice.svelte`
- `src/routes/test/celestial-asset-catalog/+page.svelte`
- `src/routes/test/celestial-asset-catalog/CloudbreakAssetCatalogScene.svelte`
- `src/routes/test/celestial-asset-catalog/catalog.ts`
- `src/routes/test/celestial-integration/+page.svelte`
- `docs/superpowers/specs/seraphic-vault/scene-gates.json`
- `tests/unit/3d-viewer/celestial-asset-catalog.test.ts`
- `tests/unit/3d-viewer/olive-cloudbreak-production.test.ts`
- `tests/unit/3d-viewer/seraphic-vault-cloudbreak.test.ts`
- `tests/unit/3d/stage-coordinate-frame.test.ts`

Cloudbreak integration adds:

- `src/lib/shared/3d/environments/scenes/celestial/CloudbreakAsset.svelte`
- `src/lib/shared/3d/environments/scenes/celestial/CloudbreakLagoonEdge.svelte`
- `src/lib/shared/3d/environments/scenes/celestial/CloudbreakSpatialStudy.svelte`
- `src/lib/shared/3d/environments/scenes/celestial/CloudbreakWaterfall.svelte`
- `src/lib/shared/3d/environments/scenes/celestial/cloudbreak-assets.ts`
- `src/lib/shared/3d/environments/scenes/celestial/cloudbreak-layout.ts`

The obsolete route-local copies are deleted:

- `src/routes/test/celestial-asset-catalog/CatalogAsset.svelte`
- `src/routes/test/celestial-asset-catalog/CloudbreakSpatialStudy.svelte`
- `src/routes/test/celestial-asset-catalog/CloudbreakWaterfall.svelte`

Existing Revision 6 gate documents, screenshots, `ReflectivePool` work, and
tracker changes remain part of the larger uncommitted Cloudbreak package.

## Remaining work, ranked

1. **Obtain explicit Gate 1 approval or park the candidate.** Record Austen's
   exact approval quote and spatial read through the museum tracker and gate
   manifest. Do not infer approval from praise or from this runtime integration.

2. **Replace the sanctuary and mesas at production quality.** The rear
   sanctuary is still an intentional 42 by 26 metre graybox. The floating banks
   establish depth but remain blocky beside the finished olives. Preserve the
   measured opening, path, stage clearance, mixed elevations, and four-bank
   horizon during the model pass.

3. **Refine visible materials.** The broad shelf exposes repeated ground texture
   and bright patches. The stage is still visually plain, and parts of the
   lagoon bank remain engineered.

4. **Finish the waterfall treatment.** Improve breakup, mist, rock contact, and
   the transition between the lagoon crest and the main drop. Avoid translucent
   sheets pasted onto mesa faces.

5. **Run a controlled performance benchmark.** Warm the scene, hold each
   performer count for a fixed interval, and sample the existing Gate 5 probe.
   The current visual-session readings are encouraging but not release evidence.

6. **Repeat Gates 2 through 5 after Gate 1 approval.** Re-register targets from
   the approved plan, prove production asset replacement, repeat performer
   integration, and complete final acceptance in order.

## Decisions that remain binding

- Olive Cloudbreak must feel peaceful, beautiful, and broadly inviting without
  relying on religious symbolism.
- Preserve one restrained lagoon, two visibly different olive trees, a dry
  central stage, the worn route, four distant floating banks at mixed
  elevations, and one infinitely distant sun.
- The shelf belongs to a larger inhabited place. A monumental rear sanctuary
  explains the route, but the fixed background is a place people pass through,
  not a literal arrival or departure sequence.
- Free licensed geology should fill ordinary rock needs. Meshy credits belong
  to signature assets that cannot be sourced, including the custom olives and
  eventual sanctuary or mesa work.
- The production cloud panorama belongs in every visual review.
- Use the in-app browser for Cloudbreak visual work. Do not open a separate
  DevTools browser window.

## Gotchas

- Port `5173` is Austen's HTTPS dev server. Do not start, stop, restart, or kill
  it. The current review uses the existing server on `5176`.
- The celestial native stage surface is deliberately `0.225`. Changing it back
  to `0.01` sinks performers into the approved raised terrace.
- `OliveCloudbreakSlice.svelte` still preserves the shell GLB's X/Z flip and
  `userProportionsState.groundY` offset. Breaking that relationship separates or
  mirrors performers and scenery.
- The reflector consumes the 15-point local lagoon outline. A second sign
  conversion mirrors it. The shoreline shader currently supports at most 16
  segments.
- The shared lagoon edge owns disposable Three.js geometries and materials.
  Preserve that lifecycle.
- The distant waterfalls must remain just in front of mesa geometry to avoid
  depth occlusion.
- The sun's camera-centred transform is the distance illusion. Do not replace it
  with a fixed world-space sphere.
- The git index and worktree are shared. Commit only explicit Cloudbreak paths;
  never use `git add .`, `git add -A`, or `git add -u`.
