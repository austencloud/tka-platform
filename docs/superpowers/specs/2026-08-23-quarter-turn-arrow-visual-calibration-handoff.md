# Quarter-Turn Arrow Visual Calibration: Fable 5 Handoff

**Date:** 2026-08-23  
**Repository:** `E:\tka-platform`  
**Branch:** `main`  
**Base HEAD when written:** `fa624bff2eaa2f3a2360844fba649ebb8980d0d4`  
**Working-tree state:** heavily dirty and shared with other live work  
**Governing design:** [Quarter-Turn Pictograph Arrows](./active/2026-08-23-quarter-turn-pictograph-arrows-design.md)  
**Primary acceptance fixture:** [SpiroAnim 24-step Club loop](../../research/spiroanim/editor-v9-quarter-turn-club-loop.json)

## Mission

Make `turns: 0.25` arrows visually correct across TKA without repeating the old process of hand-authoring and hand-positioning every orientation in isolation.

The current implementation proves that quarter-turn data can travel through the domain, resolver, browser renderer, Card raster pipeline, and MCP renderer. It does **not** prove that the new arrows look right. Austen's review on 2026-08-23 was unambiguous: the turn tuple now appears, but the arrows are all visually wrong. The task is therefore a visual-system reconstruction and calibration job, not another path-resolution patch.

Preserve the structural plumbing that is already working. Replace the unapproved art and the zero-anchor placement assumption with one deterministic geometry source, an exhaustive review lab, machine-checkable invariants, and a small set of deliberate human approvals.

The target workflow is:

1. Machines enumerate and inspect every valid state.
2. Symmetry and orientation algebra reduce that state space to proven equivalence classes.
3. Austen approves one canonical representative from each proven class plus every detected outlier.
4. Generated art and placement metadata become the reproducible source, while the existing runtime resolver and placement tiers remain the production owners.

## Done - verified

### 1. Quarter-turn structural support exists end to end

The implementation added exact `0.25` handling to the shared render-core asset resolver, browser arrow resolver, MCP standalone renderer, fractional orientation calculation, eight-state arrow transition logic, TKA number glyph handling, and placement-key routing. It also added 32 SVG assets at the filenames expected by the production resolver.

Evidence on 2026-08-23:

- `Get-ChildItem static/images/arrows -Recurse -Filter '*_0.25.svg'` returned exactly **32** assets.
- Focused structural suites reported **156 passing tests** earlier in this task: 123 primary focused tests, 17 render-core tests, 2 sequence-engine tests, and 14 MCP Node tests.
- `pnpm --filter @tka/render-core build` completed successfully earlier in this task.
- XML parsing succeeded for all 32 quarter-turn SVGs.
- The browser and MCP resolvers share `packages/render-core/src/calculations/arrow-asset-path.ts` instead of maintaining independent quarter-turn routing logic.

Commit: **none**. The quarter-turn implementation is uncommitted in the shared `main` working tree at the base HEAD above. Re-run the structural suites before preserving or committing it because other sessions are editing the same checkout.

### 2. The visible `0.25` turn tuple works in Card raster cells

The missing tuple in the user's Card screenshot was not an SVG-arrow problem. IndexedDB still held persistent `lsp11` / `lsp12` bitmap cells created before `static/images/numbers/0.25.svg` existed. A targeted cache-key revision was added only for pictographs that display TKA and contain a visible quarter-turn motion. The direct canvas renderer was also connected to the canonical turn-tuple generator.

Evidence on 2026-08-23:

- `pnpm exec vitest run --config tests/config/vitest.config.ts tests/unit/CellCacheKeyDeriver.test.ts` passed **21 of 21** tests.
- `pnpm exec eslint src/lib/shared/render/services/pictograph-key-hasher.ts src/lib/shared/render/services/canvas-2d-direct-renderer.ts --no-warn-ignored` exited 0.
- `pnpm check` reported **0 errors and 0 warnings**.
- Runtime IndexedDB inspection found **3,376** total cache keys, **72** keys carrying `quarter-turn-glyph-v1`, and **25** raster cells on the rendered Card.
- Browser inspection of the exact 24-step Club sequence showed blue and red `0.25` tuples in every motion cell.

Commit: **none**. The relevant edits are uncommitted. `canvas-2d-direct-renderer.ts` also contains unrelated PostHog exception-reporting changes from another session, so do not replace or revert the whole file.

### 3. The domain algebra needed for an exhaustive validator is known from the TKA MCP

Fresh MCP queries on 2026-08-23 established:

- Relative orientations form the eight-state cycle `in -> clockIn -> clock -> clockOut -> out -> counterOut -> counter -> counterIn`.
- A quarter turn advances one orientation state and contributes 45 degrees of base rotation because one TKA turn is 180 degrees.
- Anti, Dash, and Hash follow the rotation direction; Pro and Static oppose it.
- Curved-path and straight-path motion families retain their existing TKA meanings and skew modifiers.

This is sufficient to build a semantic state enumerator and chirality oracle. Re-query the MCP if any domain rule appears ambiguous. Repository memory or visual intuition is not canonical.

Commit: not applicable. This is read-only domain evidence.

### 4. The visual failure has two independent, measured causes

The new art and the new placement are both uncalibrated.

Evidence on 2026-08-23:

- All **32 of 32** quarter-turn SVGs contain stroke-based geometry (`stroke-width`).
- The comparable legacy Pro, Anti, Static, and Dash corpus contains **60** non-quarter motion assets and **0** stroke-based assets. Representative legacy files are authored as filled silhouettes with a materially different arrow grammar.
- `rg -l '0\.25|\.25' static/data/arrow_placement` returned **0 placement files**.
- `src/lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer.ts` explicitly returns `{ x: 0, y: 0 }` when quarter-turn placement data is absent.
- Existing resolver tests assert path identity, parseability, viewBox availability, and recoloring. Existing rotation tests assert finite, turn-agnostic transforms. None of them establish visual correctness, tangency, clearance, or placement.
- The legacy authored sources still exist at `static/images/arrows/TKA-Arrows.ai` and `static/images/arrows.pdf`.

Commit: not applicable. This is a source and asset census against the uncommitted working tree.

## Believed done - unverified

- The shared resolver appears to cover the intended valid quarter-turn matrix: Pro and Anti relative paths, Static self paths, Dash and Hash paths, four relative axis families, and eight absolute center families for valid center-origin Static/Dash cases. The tests prove routing, not the correctness of the artwork selected for each cell.
- Case-insensitive browser and MCP orientation tokens appear normalized consistently, including interradial starts such as `clockIn` and `clockOut`. Pixel-level browser/MCP/export parity has not been established.
- The 24-step SpiroAnim-derived sequence was saved privately as `seq_1787513995601_9047041b` with word `HHHFLFAAALFLHHHFLFAAALFL`, diamond grid, Club props, and `turns: 0.25` throughout. Re-query Firestore or open the JSON fixture before treating the remote record as durable evidence.
- The sequence seam and orientation closure were checked earlier, but the sequence has **not** passed visual arrow approval.
- The current design spec says `Status: Implemented 2026-08-23`. That status is no longer credible after human review. Treat it as structural implementation only until the spec is corrected.

## In flight

### Runtime and domain changes

- `packages/render-core/src/calculations/arrow-asset-path.ts`
- `packages/render-core/src/calculations/orientation.ts`
- `packages/render-core/src/index.ts`
- `packages/sequence-engine/src/core/orientation/OrientationCalculator.ts`
- `src/lib/shared/render/core/calculations/orientation.ts`
- `src/lib/shared/pictograph/arrow/rendering/services/arrow-path-resolver.ts`
- `src/lib/shared/pictograph/arrow/rendering/services/arrow-svg-color-transformer.ts`
- `src/lib/shared/pictograph/arrow/rendering/services/arrow-orientation-transition.ts`
- `src/lib/shared/pictograph/arrow/rendering/components/ArrowSvg.svelte`
- `src/lib/shared/pictograph/arrow/positioning/key-generation/services/arrow-placement-key-generator.ts`
- `src/lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer.ts`
- `mcp-server/src/core/standalone-renderer.ts`
- `mcp-server/src/core/arrow-adjustment.ts`
- `src/lib/shared/navigation/services/sequence-encoder.ts`

### Glyph and raster-cache changes

- `static/images/numbers/0.25.svg`
- `src/lib/shared/pictograph/tka-glyph/utils/turn-tuple-parser.ts`
- `src/lib/shared/pictograph/tka-glyph/utils/__tests__/turn-tuple-parser.test.ts`
- `src/lib/shared/render/services/glyph-cache.ts`
- `src/lib/shared/pictograph/shared/services/svg-preloader.ts`
- `src/lib/shared/render/services/svg-image-cache.ts`
- `src/lib/shared/render/services/canvas-2d-direct-renderer.ts`
- `src/lib/shared/render/services/pictograph-key-hasher.ts`
- `tests/unit/CellCacheKeyDeriver.test.ts`

### Tests and documentation

- `packages/render-core/tests/arrow-asset-path.test.ts`
- `packages/render-core/tests/orientation-fractional.test.ts`
- `packages/sequence-engine/tests/core/orientation-fractional.test.ts`
- `src/lib/shared/pictograph/arrow/rendering/services/__tests__/arrow-path-resolver-quarter.test.ts`
- `src/lib/shared/pictograph/arrow/rendering/services/__tests__/arrow-orientation-transition.test.ts`
- `src/lib/shared/pictograph/arrow/positioning/calculation/services/__tests__/arrow-rotation-calculator-quarter.test.ts`
- `src/lib/shared/pictograph/arrow/positioning/placement/services/__tests__/quarter-turn-placement.test.ts`
- `mcp-server/tests/rendering-boundaries.test.ts`
- `.claude/agents/arrow-positioning-expert.md`
- `docs/superpowers/specs/active/2026-08-23-quarter-turn-pictograph-arrows-design.md`
- `docs/research/spiroanim/editor-v9-quarter-turn-club-loop.json`

### Generated but visually rejected assets

- `static/images/arrows/pro/**/pro_0.25.svg` - 4 files
- `static/images/arrows/anti/**/anti_0.25.svg` - 4 files
- `static/images/arrows/static/**/static_0.25.svg` - 12 files
- `static/images/arrows/dash/**/dash_0.25.svg` - 12 files

Do not tune these files one at a time. They are scaffolding and should be regenerated from an approved source model.

### Runtime state that may still exist

- A private Vite server was running on port `5174` in execution session `92756` when this handoff was written. Do not assume it survives task transfer.
- Shared Chrome debug page ID `16` was open on the exact Card fixture in dark mode, six columns, Club props, and TKA enabled.
- The sequence URL was:
  `https://localhost:5174/sequence/d1%3ACw11dq5JTUxNrDCwglBAXnF-qYGekSlQAMqqKc4vT4WIwVk15al5UHVwVk1efmoiRCwPrg5hXnkqNvOgOoDmIeyFmQeXRTEPYS_MPLgsivsQ9mIzD2bvCPMvAA?view=animation&render=&bpm=80&bp=C&rp=C`

## Loose ends

### 1. Correct the governing status and freeze the usable substrate

Change the design status from `Implemented` to something accurate such as `Structural support complete; visual calibration blocked`. Preserve the shared resolver, exact `0.25` formatting, orientation algebra, turn tuple, and cache revision unless evidence disproves them. Explicitly mark the 32 current SVGs and the zero-anchor placement fallback as unapproved.

### 2. Build the legacy visual contract before drawing new art

Use `TKA-Arrows.ai`, `arrows.pdf`, and representative production SVGs to make a compact golden reference board. Measure and name the properties that the old hand-authored corpus expresses:

- filled silhouette and taper profile;
- arrowhead proportions and attachment;
- path curvature and endpoint tangency;
- visual weight at pictograph scale;
- canonical local anchor and bounding box;
- clearance from grid dots, props, the TKA tuple, and the other hand's arrow.

Austen should approve this board before broad generation. The approval is about the visual language, not about individual quarter-turn cases.

### 3. Establish one parametric quarter-arrow source in `@tka/render-core`

Extend the existing production owner instead of creating a parallel renderer. The deterministic geometry source should accept the semantic state needed to produce a canonical arrow: motion, direction, start/end orientation, path/skew family, and center frame where valid. It should emit:

- a filled SVG silhouette matching the legacy contract;
- canonical anchor and bounds;
- endpoint tangent/chirality metadata;
- collision envelope or sampled outline metadata;
- a traceable generator version for cache invalidation.

Generate the existing filename matrix from this source. Treat the SVG files as generated artifacts. If a motion family needs separate parameters, encode that as a named model class or explicit exception, never as an unexplained hand edit to one output file.

### 4. Prove the symmetry reduction instead of assuming it

Enumerate every valid semantic quarter-turn state from the MCP-backed orientation algebra. Partition states by rotations and mirrors only when numerical transforms prove equivalence. Compare generated outlines after normalization. Any case that does not match its proposed class becomes an explicit outlier and requires separate review.

Expected high-level families include radial, nonradial, interradial clock-in, interradial clock-out, skew `+`, skew `-`, hash-in, and eight absolute center-origin hash-out/static directions. Do not collapse center opposites or skew variants without geometric proof.

### 5. Build a dev-only quarter-turn review lab

Create a `/test/quarter-turn-arrows` lab using the production renderer, resolver, and placement engine. It should provide:

- isolated glyph and complete pictograph views side by side;
- grid, prop, both hands, TKA tuple, anchor, bounds, path tangent, and collision overlays;
- filters for motion, direction, orientation, grid, skew, center cases, prop type, prop classification, and placement tier;
- contact-sheet export for canonical representatives and detected outliers;
- a placement-tier breakdown showing canonical, default, prop, special, manual, and global contributions;
- before/after comparison against the current generated asset and nearest legacy reference.

The lab may edit shared generator parameters or the existing placement data owners. It must not introduce a second production placement engine.

### 6. Add machine oracles that catch silent visual errors

At minimum, enforce:

- semantic end orientation agrees with MCP-backed algebra;
- direction and motion chirality agree with endpoint tangents;
- proven mirror/rotation partners normalize to equivalent geometry;
- every valid state resolves, parses, stays finite, and is unclipped;
- collision envelopes clear dots, props, the other arrow, and the turn tuple at defined tolerances;
- browser live SVG, Card raster worker, MCP, and export pipelines resolve the same asset identity and equivalent placement;
- all non-quarter render/cache keys and pixels remain unchanged;
- generated files exactly match the generator output in CI.

Use automated contact-sheet triage to cluster failures and rank the smallest parameter change with the broadest safe effect. AI can propose corrections and explain downstream impact. It does not grant final visual approval.

### 7. Calibrate placement through the existing tier system

The current zero anchor is only a placeholder. Start with canonical geometry and the staff baseline, then use automated collision and optical-balance metrics to identify classes that need offsets. Preserve the existing priority order for exact/authored, prop-specific, special, global, and manual adjustments. Test with placement layers toggled independently so a higher tier cannot hide a broken base model.

Use representative prop extremes rather than blindly hand-authoring every prop:

- small and big;
- unilateral and bilateral;
- narrow and wide silhouettes;
- Club as the primary SpiroAnim acceptance prop;
- any automated collision outlier.

### 8. Release only through hard acceptance gates

Required gates:

- zero missing-art, semantic, chirality, symmetry, clipping, or non-finite failures;
- zero unexplained collisions;
- browser/Card/MCP/export parity;
- non-quarter output remains unchanged;
- every canonical representative has recorded human approval;
- every machine-detected outlier has recorded approval or a documented exception;
- all 24 cells of the SpiroAnim Club fixture are approved in the actual Card view;
- the generator version is reflected in the targeted quarter-turn cache revision.

## Decisions already made

- On 2026-08-23 Austen accepted the visible `0.25` tuple and rejected the quarter-turn arrows as visually wrong across the board.
- Structural support and visual approval are separate completion states. Passing resolver tests cannot close this feature.
- The mature runtime resolver and placement tier system stay authoritative. Extend them; do not build a second production implementation.
- The 32 current quarter-turn SVGs are unapproved scaffolding, not a visual baseline.
- Exhaustive machine inspection plus limited human approval is the intended operating model. The human reviews canonical representatives and outliers, not every permutation by hand.
- The legacy arrow corpus and Illustrator/PDF sources define the visual grammar.
- The 24-step SpiroAnim Club loop is the primary end-to-end acceptance fixture.
- Generated geometry must be reproducible. Manual edits to emitted quarter-turn SVGs are not acceptable source-of-truth changes.

## Gotchas

- **Shared worktree:** `main` was already one commit ahead of `origin/main` before this handoff, and hundreds of unrelated files are dirty. Do not reset, clean, stash, or broadly commit. Inspect every overlapping diff. If committing, use explicit pathspecs only.
- **Do not push blindly:** pushing the current branch would also publish the pre-existing local commit `fa624bff2e` and any later commits. Audit provenance first.
- **No branch or worktree:** repository policy requires Austen's explicit request before creating either.
- **Port 5173 belongs to Austen:** never start, stop, restart, or kill it. Use a separate port for private verification.
- **Direct-load bug:** a hard refresh on the sequence URL can fail with `PublicIndexSyncer factory not registered. Ensure registerPublicIndexSyncerFactory() is called at app startup.` The proven workaround was to enter through another client route and navigate internally. This is not known to be caused by quarter turns.
- **Old console noise:** the shared browser contains earlier 404 and `PublicIndexSyncer` errors. Attribute errors only after reproducing them in the task-owned page.
- **Placement and art are independent:** a beautiful canonical SVG can still be wrong in the cell, and perfect offsets cannot rescue the wrong silhouette.
- **Higher placement tiers can hide defects:** test canonical placement alone before prop/special/manual/global layers.
- **TKA quarter turn means 45 degrees:** one TKA turn is 180 degrees. Do not interpret `0.25` as a 90-degree quarter-circle without checking the domain algebra.
- **Center cases are special:** center rotation maps intentionally collapse, so valid Static/Dash center-origin art carries absolute orientation identity. Opposites are not automatically the same asset.
- **Float is not numeric quarter:** Float remains `turns: "fl"`; numeric `0.25` Float is invalid.
- **`noRotation` is not a valid escape hatch:** nonzero quarter turns with `noRotation` are invalid domain data even if compatibility code coerces a direction.
- **Cache invalidation is targeted:** do not globally invalidate the pictograph cache. The current key revision affects only visible quarter-turn TKA glyphs.
- **MCP typecheck has an unrelated known failure:** `mcp-server/src/core/text-renderer.ts(163,5)` reports that `userName` does not exist in `FooterOptions`. Do not misreport it as a quarter-turn regression.
- **Rendering policy:** TKA pictographs and sequences must be rendered through the production/MCP tools, not ad hoc shell or base64 renderers. Analysis scripts may inspect generated SVG geometry, but they must not become a parallel renderer.

## Recommended first move for Fable 5

Do not start by nudging coordinates. First update the status language, produce the legacy golden reference board, and write the executable state enumerator. Those three artifacts establish what “correct” means, how many genuinely distinct cases exist, and which failures belong to art versus placement. Only then fit the parametric generator and calibrate it in the review lab.
