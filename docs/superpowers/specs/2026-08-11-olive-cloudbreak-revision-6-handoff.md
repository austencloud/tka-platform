# Olive Cloudbreak Revision 6 — Handoff (2026-08-11)

## Mission

Olive Cloudbreak is the Celestial/Sun environment: a warm natural refuge above
the clouds rather than a religious caricature of heaven. Its active direction
is one broad limestone shelf, a protected dry performance terrace, two distinct
olive trees, one restrained right-edge lagoon, a worn route to a monumental
rear sanctuary, four distant floating mesas, thin waterfalls, and one distant
sun. The governing direction is
[the Olive Cloudbreak pivot](active/2026-08-09-olive-cloudbreak-celestial-pivot.md),
the current production brief is
[Gate 1 Revision 6](seraphic-vault/seraphic-vault-gate1-r6-opus-production-pass.md),
and gate state lives in
[scene-gates.json](seraphic-vault/scene-gates.json).

The immediate future mission is to preserve the Revision 6 visual direction,
then move it into the canonical runtime without duplicating scene ownership.
The review route is visually ahead of the integrated `CelestialScene`.

## Done — verified

No Revision 6 implementation commit exists. All Revision 6 source, evidence,
and gate-index work is still uncommitted in the shared `main` checkout and is
listed under **In flight**. Do not infer that the visual package can be recovered
from Git history yet.

The following facts were verified from the live working tree on 2026-08-10 and
2026-08-11:

- The focused catalog contract passed:
  `pnpm exec vitest run --config tests/config/vitest.config.ts tests/unit/3d-viewer/celestial-asset-catalog.test.ts`
  returned 1 file passed and 6 tests passed.
- The gate manifest passed:
  `node .agents/skills/museum-scene-production/scripts/validate-scene-gates.mjs docs/superpowers/specs/seraphic-vault/scene-gates.json`
  returned `PASS: seraphic-vault gate manifest is valid`.
- The scoped `git diff --check` across the Revision 6 owners returned exit 0.
- `pnpm check:fast -- --incremental` remained red from the shared repository
  baseline, reporting 235 errors and 13 warnings, but filtering its output for
  the celestial catalog, `ReflectivePool`, its shader, and the focused test
  returned zero affected-path diagnostics.
- Front, Rear, Plan, Trees, and Stone were inspected in the in-app browser at
  `https://127.0.0.1:5176/test/celestial-asset-catalog`. The route loaded one
  canvas, six observed assets after the full tab pass, one Revision 6 label,
  zero visible alerts, and zero warning/error console entries.
- The registered Front view shows both finished olives, a distinct dry stage,
  the irregular reflective lagoon, strong contact shadows, the small distant
  sun, production clouds, four-bank depth, and visible animated mesa falls.
- The integrated Gate 5 route was inspected at
  `https://127.0.0.1:5176/test/celestial-integration?performers=8`. Performers
  were standing on the stage rather than sunk into it, and the browser console
  had zero warning/error entries.

Current subjective scorecard from a fresh 2026-08-11 visual pass:

- Revision 6 visual direction: 8.2/10
- Current production finish: 6.4/10
- Current integrated runtime assembly: 4.8/10
- Expected potential after production modeling and integration: 9/10

## Believed done — unverified

- The Revision 6 composition appears ready to pause as an art-direction
  candidate. Austen said, "It's lovely. I'm about ready to put it away for a
  while" on 2026-08-11. This is praise and pause intent, not formal Gate 1
  approval. `scene-gates.json` correctly remains `ready-for-review`.
- The visual review indicates that the large quiet foreground works as
  performer space, but Revision 6 has not yet been reviewed with performers in
  the same assembly. The current integration route displays the older runtime
  environment, so it cannot prove Revision 6 performer composition.
- The new distant waterfalls read in motion on the review route. Their final
  production quality is not proven; they still look like translucent sheets
  over the mesa faces in some frames.
- The lagoon outline, wet bank, and reflection are visually coherent in the
  review route. Their runtime cost and behavior inside the adaptive-quality
  system are not yet measured.

## In flight

- Work is on `main` at recorded pre-handoff HEAD
  `f4960b5178532957559173904e7068a6b0a539e3`. At handoff time, local `main` was
  three commits ahead of `origin/main`. Those commits belong to the shared
  checkout and must not be pushed as a side effect of Cloudbreak work.
- The repository is heavily dirty with concurrent Forest, Winter, Autumn,
  sharing, and Scene Composer work. Do not revert, stage, commit, or format
  unrelated files.
- Revision 6 owns these modified files:
  - `scripts/seraphic-vault-cloudbreak-layout.json`
  - `src/lib/shared/3d/environments/primitives/ReflectivePool.svelte`
  - `src/lib/shared/3d/environments/primitives/reflective-pool-shader.ts`
  - `src/routes/test/celestial-asset-catalog/+page.svelte`
  - `src/routes/test/celestial-asset-catalog/CloudbreakAssetCatalogScene.svelte`
  - `src/routes/test/celestial-asset-catalog/CloudbreakSpatialStudy.svelte`
  - `src/routes/test/celestial-asset-catalog/CloudbreakWaterfall.svelte`
  - `tests/unit/3d-viewer/celestial-asset-catalog.test.ts`
  - `docs/superpowers/specs/seraphic-vault/scene-development.md`
  - `docs/superpowers/specs/seraphic-vault/scene-gates.json`
- Revision 6 adds these untracked files:
  - `src/routes/test/celestial-asset-catalog/CloudbreakLagoonEdge.svelte`
  - `docs/superpowers/specs/seraphic-vault/seraphic-vault-gate1-r6-opus-production-pass.md`
  - `docs/superpowers/specs/seraphic-vault/seraphic-vault-gate1-cloudbreak-r6-front.png`
  - `docs/superpowers/specs/seraphic-vault/seraphic-vault-gate1-cloudbreak-r6-rear.png`
  - `docs/superpowers/specs/seraphic-vault/seraphic-vault-gate1-cloudbreak-r6-plan.png`
  - `docs/superpowers/specs/seraphic-vault/seraphic-vault-gate1-cloudbreak-r6-trees.png`
  - `docs/superpowers/specs/seraphic-vault/seraphic-vault-gate1-cloudbreak-r6-stone.png`
- The Revision 6 tracker provenance is proposal `9hS7oQNdNlVwHLMUvB8R`,
  derived from accepted Revision 5 decision `IhLgSyXG6tHNsFSDhv3H`.
  The proposal has not been promoted or accepted.

## Loose ends (ranked)

1. **Do not resume with more Gate 1 micro-polish.** First obtain explicit Gate 1
   approval or leave the candidate parked. If approval is requested, ask Austen
   to state the spatial read he understands, then record the exact approval
   quote and `visualComprehensionConfirmed: true` through the museum tracker and
   gate manifest.

2. **Integrate Revision 6 into the canonical runtime owner.** The live
   `CelestialScene.svelte` mounts `OliveCloudbreakSlice.svelte`, which still
   renders the older single-GLB assembly and runtime material grading. The
   Revision 6 review route composes its improvements separately. Extend the
   shared celestial owners in
   `src/lib/shared/3d/environments/scenes/celestial/`; do not import the test
   route and do not create another scene renderer.

3. **Move reusable systems out of the review route.** The canonical
   `ReflectivePool` outline support is already shared. Decide whether the
   lagoon bank and waterfall belong beside it as shared primitives or under the
   celestial scene package. Keep the 15-point layout contract as geometry
   truth. The test route should become a thin review shell over the same runtime
   components.

4. **Restore runtime visual parity.** The 2026-08-11 Gate 5 screenshot still
   showed the older rounded-canopy trees, repeated stone ring, bright cyan
   lagoon, unrefined stage, and old mesa treatment. Integrate the two custom
   olives, shaped wet bank, sparse CC0 clusters, stage/path materials, corrected
   directional lighting, distant sun, and visible waterfalls.

5. **Rebuild the sanctuary and mesas at production quality.** The rear
   sanctuary remains an intentional 42 by 26 metre graybox. The distant mesas
   establish depth but are visibly blocky next to the finished olives. Replace
   these through one production-model pass after the visual direction is
   approved. Preserve the measured opening, path, stage clearance, and four-bank
   horizon.

6. **Refine the remaining visible materials.** The broad shelf still exposes
   repeated ground texture and bright patches. The stage is still a plain disc,
   lagoon edges remain somewhat engineered, and waterfall sheets need better
   breakup, mist, and rock contact.

7. **Rebaseline performance after parity.** In the 2026-08-11 in-app review,
   the stale Gate 5 assembly reported approximately 23 FPS with eight
   performers, 22 FPS with four, and 25 FPS solo. The nearly flat result suggests
   environment or test-harness overhead rather than performer scaling, but that
   is an inference. Use the existing Gate 5 probe and proper warm sampling after
   Revision 6 integration. Do not treat the old 60 FPS evidence or these ad hoc
   readings as proof of the new assembly.

8. **Repeat the real gate sequence after integration.** Gate 2 through Gate 5
   evidence predates the reopened asset-quality and spatial amendments. The
   manifest correctly leaves later gates pending. Rebuild only from the approved
   plan contract, then repeat registered targets, production slice, integration,
   and final acceptance in order.

## Decisions already made

- The celestial background is Olive Cloudbreak, not the feathered Seraphic
  Vault concept. It should feel peaceful, beautiful, and broadly inviting
  without relying on religious symbolism.
- Preserve one lagoon with restraint. Do not multiply lagoons or turn water
  into the whole setting.
- Preserve two visibly different olive trees, a dry central stage, the worn
  path, four distant floating banks at mixed elevations, and one distant sun.
- The shelf belongs to a larger inhabited place. A monumental rear stone
  sanctuary explains the path, but the fixed background is a location people
  pass through rather than a literal arrival/departure sequence.
- The rear sanctuary may remain graybox at Gate 1. Do not disguise it as a
  finished facade before its production-model pass.
- Free licensed geology should fill ordinary rock needs. Meshy credits are for
  signature assets that cannot be sourced, including the custom olives and
  eventual sanctuary/mesa work.
- The production cloud panorama belongs in every visual review.
- The sun must behave as an infinitely distant sky element, never as a nearby
  ball placed inside the scene.
- Use the in-app browser for Cloudbreak visual work. Do not open a separate
  DevTools browser window.

## Gotchas

- Port `5173` is Austen's HTTPS dev server. Do not start, stop, restart, or kill
  it. The review used Austen's existing server on `5176`. Reuse the in-app
  browser and the active server rather than opening external windows.
- `OliveCloudbreakSlice.svelte` flips both X and Z and offsets the GLB by
  `userProportionsState.groundY`. Preserve that coordinate relationship or
  performers and the environment will separate vertically or mirror laterally.
- The reflector consumes a local outline after the review route negates local
  Z to account for the rotated water plane. A second sign conversion will mirror
  the lagoon.
- The new shoreline shader supports at most 16 segments. The current contract
  uses 15. If the outline grows, update the shader contract and focused test
  together rather than silently dropping segments.
- `CloudbreakLagoonEdge.svelte` creates and disposes its own geometries and
  materials. Preserve that lifecycle when moving it into shared runtime code.
- The distant waterfalls were initially invisible because their planes sat
  inside or behind mesa geometry. Moving them just in front of the rock faces
  fixed depth occlusion. Do not restore the old Z positions.
- The main lagoon overflow is registered in Plan but the vertical drop cannot
  be seen from the Front camera because the camera stands on the long shelf.
  The hero view instead reads the lagoon crest plus visible distant mesa falls.
- Current Gate 5 controls and performance probe are useful, but its environment
  is stale. A green console there does not prove Revision 6 parity.
- The browser performance samples are development-session observations, not a
  controlled benchmark.
- The git index and worktree are shared. Use explicit pathspecs for every commit.
  Do not stage with `git add .`, `git add -A`, or `git add -u`.
