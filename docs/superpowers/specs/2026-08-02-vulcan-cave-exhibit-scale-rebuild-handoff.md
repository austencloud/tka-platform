# Vulcan Cave Exhibit-Scale Rebuild Handoff

- **Date:** 2026-08-02
- **Status:** Ready for another agent to assess and propose the rebuild. The current 3D cave is rejected as an art and scale target.
- **Branch:** `main`
- **Worktree base when written:** `a6b4da841c3993af3b54a99895a4702d55523e08`
- **Governing tracker decisions:** `VyGMg2dcpRttLAGRSIG5`, `mX982dvKMyhhL2wIvu6V`, `ilOm4CbDiWqH46swlYTT`

## Mission

Turn the approved six-solo Vulcan Cave concept into a rich web museum environment. The immediate target is one final-quality chamber that proves the spatial system, exhibit density, gated habitat staging, prehistoric performer, bespoke period prop, lighting, sound, and environmental storytelling together.

Do not duplicate the chamber across all six modes until Austen approves that vertical slice. The current scene is useful as a technical movement and animation harness only.

This handoff is a plan and state transfer, not authorization to start the non-trivial rebuild. The next agent should inspect the evidence, prepare the revised spatial and asset plan, and obtain Austen's explicit approval before implementation.

## What failed in the reviewed build

The spatial graph survived first-person testing. The room design did not.

The compiled performer spaces are:

| Chamber | Current clear interior | Result |
| --- | ---: | --- |
| Water | 6 x 6 m | Space for a mannequin, not an exhibit |
| Fire | 6 x 6 m | Same failure |
| Earth | 8.5 x 8.5 m | Still cannot hold the promised habitat, gate, visitor apron, and tactile exhibit comfortably |
| Air | 6 x 8.5 m | Reads as a narrow box |
| Sun | 5.5 x 5.5 m | Too small |
| Moon | 5.5 x 5.5 m | Too small |

The entire compiled field is 53 x 36.5 m, with 357 m² of interior area across all nine spaces. The implementation put the existing generic `MuseumPerformerStation3D` mannequin and standard TKA props in those rooms, then differentiated the rooms mainly with colored point lights, dust, floor glows, and a few tinted Kenney rocks. It did not provide:

- a visitor-side exhibit and interpretation zone;
- a gate or architectural barrier;
- a recessed cave habitat behind that barrier;
- a prehistoric human presentation for the automaton;
- bespoke rough-hewn sticks or torches;
- cave-life artifacts or readable environmental narrative;
- a continuous authored cave shell;
- enough distance, occlusion, or layering for a dramatic reveal.

Austen's 2026-08-02 review explicitly rejected this result. Do not treat clean tests, responsive screenshots, or functioning animation as evidence that the room experience is accepted.

## Recommended spatial target

The strongest interpretation of Austen's direction is a continuous visitor gallery with six deep habitat bays, not six little rooms that the player walks into.

Each encounter should have four spatial layers:

1. **Approach and occlusion:** A curved passage, rock fin, or elevation change hides the next performer and kills acoustic bleed.
2. **Public interpretation apron:** Enough clear floor for the visitor to stop, move laterally, read a plaque, inspect two or more artifacts, and use an interaction without standing inside the performer volume.
3. **Gate or architectural threshold:** A deliberate museum barrier set into the cave opening. The material and exact form are still open, but the physical separation is decided.
4. **Recessed habitat:** A deep scenic volume containing the prehistoric automaton, performance clearance, fire or other motivated light, cave formations, gathered material, artifacts, and a composed background.

This arrangement preserves six solo encounters without forcing the player to traverse the full floor area of every habitat. The gallery can remain mostly linear and compact while each exhibit reads as much larger than the public path.

### Starting envelope for study, not canon

Use a first-person graybox to test roughly 12-16 m of visible habitat width, 16-22 m of total bay depth, and 6-10 m of irregular vertical volume. Reserve roughly 3-5 m at the front for public circulation and interpretation, then place the performer well inside the recessed environment. These numbers are a starting range, not an accepted dimension set. The eye-level review decides.

Recommended first vertical slice: **Water**. It is the first performer reveal and currently one of the minimum-size chambers. If Water can carry a complete exhibit without relying on Earth being unusually large, the base module is healthy. Earth and its tactile four-beat interaction should be the second proof point.

## Candidate acceptance rubric for the first chamber

The next plan should turn these into measurable checks before implementation:

- From the approach, the visitor reads a cave opening and layered habitat, not a rectangular room with props near the walls.
- The gate, public apron, exhibit material, performer clearing, and scenic background are all visible as separate depth layers.
- The visitor can stand at several useful viewing positions without blocking circulation.
- The performer reads immediately as a prehistoric human or museum automaton representing one, with a serious researched treatment rather than cartoon caveman shorthand.
- Both performance props are bespoke rough-hewn branches, carved wood, or torches appropriate to the fiction. No standard modern TKA staff mesh is visible.
- At least one anchor exhibit and several supporting objects reward inspection. The exact count should come from the exhibit program, not decorative scatter.
- Light has visible sources and material consequences. Fire warms nearby stone, damp areas respond differently, and darkness shapes the reveal.
- Sound establishes distance and habitat: fire, water, air movement, foot contact, prop movement, and controlled spill from the next chamber.
- The TKA sequence remains legible and the props remain registered to the hands throughout the motion.
- No second performer is visible or acoustically dominant.
- The room looks intentional in a still screenshot and remains convincing while walking through it.

## Technical direction

### Preserve

- The Svelte, Threlte, Three.js, and Rapier web stack.
- `DimensionFlipProof.svelte` and `Museum3DScene.svelte` as the proven controller, collision, streaming, and room-entry foundation.
- The graph-first room compiler, corridor router, connectivity checks, and floor-plan review route.
- The accepted linear order: Threshold, Squeeze, Water, Fire, Earth, Air, Sun, Moon, Egypt Threshold.
- Six separate autoplay sequences and one performer per mode.
- The half-metre navigation grid as an invisible spatial and collision scaffold where useful.

### Replace or redesign

- The current 5.5-8.5 m performer-room dimensions.
- `VulcanCaveScenicLayer.svelte` as the final art strategy. It may be deleted or reduced to a temporary debug layer after the replacement exists.
- The generic pedestal mannequin presentation in `MuseumPerformerStation3D.svelte` for cave automatons.
- The use of `PropType.STAFF` and user settings to choose visible cave props.
- Generic tiled box walls as the visible cave interior.
- Mode identity that relies on color swaps.

### Preferred architecture

Keep navigation and authored art separate. The room graph should describe walkable public space, performer ownership, portals, and occlusion. An optimized authored GLB shell or a room-presentation assembly should supply the visible cave, gate, habitat, and set dressing over that scaffold.

The lobby already establishes a `presentation.modelPath` route for authored room dressing. Inspect and extend that system before adding another cave-only branch to the generic renderer. `Museum3DScene.svelte` currently imports `VulcanCaveScenicLayer.svelte` directly; continuing to add exhibit-specific branches there will turn the shared scene into a museum-wing switchboard.

For performers, preserve the existing `PerformerRig` sequence and motion path if possible, but separate motion from appearance. Investigate the existing avatar-model selection path (`avatarModelId` / `setModel`) and the prop render path before creating a parallel animation system. The likely target is a cave-specific presentation descriptor that selects an approved prehistoric character model and two visual prop meshes while retaining TKA hand and motion data.

## Asset and research pass required before code

The repository already contains cave cliff pieces, rock sets, campfire assemblies, trees, vegetation scatter utilities, torch materials, and avatar model infrastructure. The rejected scene used only three rock models. Inventory the existing assets and their licenses before acquiring or building replacements, but do not assume the low-poly Kenney vegetation library is suitable for the final-quality slice.

No suitable prehistoric human or bespoke rough-wood performance prop was found in the initial internal search. That gap needs an explicit acquisition or authoring decision. Confirm rig compatibility, web polygon and texture budgets, animation retargeting, prop pivot conventions, hand registration, and license terms before committing to an asset.

Use these real-world cave-replica references as the first visual study set:

- [Lascaux IV official visit](https://lascaux.fr/en/visit-lascaux-iv/): full-scale cave atmosphere followed by modern interpretation spaces.
- [French Ministry of Culture: Grotte Chauvet 2](https://archeologie.culture.gouv.fr/chauvet/en/grotte-chauvet-2-ardeche): recreation of the original cave's conditions and sense of scale.
- [Cosquer Méditerranée official cave visit](https://www.grotte-cosquer.com/en/visit-the-cosquer-cave/): controlled visitor movement through a cave replica with a strong discovery frame.
- [Lascaux IV 360-degree video](https://www.youtube.com/watch?v=mAxC5gXKZEA): useful for judging passage width, wall proximity, darkness, and the difference between a cave volume and a decorated box.

Study how those spaces use thresholds, winding routes, darkness adaptation, constrained visitor paths, monumental voids, detailed surfaces, bones or artifacts, and sparse motivated lighting. Do not copy a real cave or living tradition. The museum remains fictional, and the performer/costume treatment should be researched and serious.

The project rule against hand-rolling applies. Before creating components or acquiring assets, perform both internal and external searches and record why the selected path is the best fit.

## Done - verified

No art-complete cave room is done.

The following technical facts were verified, but they do not constitute an accepted deliverable:

- The graph compiles to nine connected spaces with exactly six solo performer records and six distinct autoplay sequences.
- Focused cave tests passed: 9 tests in `tests/unit/museum/vulcan-cave-floor-plan.test.ts`.
- Re-run while writing this handoff on 2026-08-02: the cave and lobby floor-plan tests passed 17 tests across two files.
- Re-run while writing this handoff on 2026-08-02: `pnpm run check` reported `svelte-check found 0 errors and 0 warnings`.
- The live route returned HTTP 200 and loaded in first-person at 1920x1080, 2560x1440, 3840x2160, 1440x900, 820x1180, 960x412, and 375x667.
- The plan page successfully navigated to `/test/museum-cave-3d`.
- The compiled-size diagnostic on 2026-08-02 produced the dimensions recorded above.

**Commit SHA for the cave implementation:** none. The cave code remains uncommitted in the shared worktree. The verified base commit was `a6b4da841c3993af3b54a99895a4702d55523e08`.

**Museum decision evidence:** tracker item `VyGMg2dcpRttLAGRSIG5` is accepted and linked as derived from the six-solo decision `mX982dvKMyhhL2wIvu6V`. This tracker state is external to Git, so no commit SHA applies.

## Believed done - unverified

None. Do not carry any visual-quality assumption forward from the current scene.

The six sequence loops were originally generated and inspected against the intended timing/direction categories, but any future change to TKA domain behavior must be verified through the `flow-arts` MCP rather than memory.

## In flight

These files contain the rejected but technically useful cave pass:

- `docs/superpowers/specs/active/2026-08-02-vulcan-cave-floor-plan-design.md`
- `src/lib/features/museum/data/vulcan-cave-floor-plan.ts`
- `src/lib/features/museum/components/game/VulcanCaveScenicLayer.svelte`
- `src/routes/test/museum-cave-plan/+page.svelte`
- `src/routes/test/museum-cave-3d/+page.svelte`
- `tests/unit/museum/vulcan-cave-floor-plan.test.ts`
- cave additions in `src/lib/features/museum/data/museum-exhibit-sequences.ts`
- cave additions in `src/lib/features/museum/data/museum-room-content.ts`
- cave integration in `src/lib/features/museum/components/game/Museum3DScene.svelte`

Useful runtime screenshots from the rejected pass were written to the Windows temp directory under names including `museum-cave-water-1920.webp`, `museum-cave-earth-1920-v3.webp`, `museum-cave-fire-1920.webp`, `museum-cave-air-1920.webp`, `museum-cave-moon-1920.webp`, `museum-cave-threshold-fixed.webp`, and viewport captures such as `museum-cave-4k.webp`. They are diagnostic evidence, not references to emulate, and may disappear during temp cleanup.

The task-owned Vite server used port 5174. It should be treated as ephemeral. Port 5173 belongs to Austen's HTTPS/2 development server and must not be stopped or restarted.

## Loose ends, ranked

1. **Re-author the spatial program.** Produce a revised 2D plan that shows the public gallery, gate, recessed habitat, performer clearing, artifact placements, sightline blockers, and dimensions for all six encounters. Do not proceed from room rectangles alone.
2. **Define the Water vertical-slice art target.** Create a reference board and shot list from real cave replicas, museum habitat displays, researched Paleolithic material culture, and the project's own story bible. Include arrival, gate reveal, left and right viewing positions, performer close view, and exit view.
3. **Resolve the prehistoric performer pipeline.** Audit existing avatar rigs and models, determine whether an existing rig can accept an authored character skin, and prove retargeting with one sequence before dressing the room.
4. **Resolve bespoke prop rendering.** Keep TKA motion data but render rough branch or torch meshes with correct length, pivots, grip, collision, and hand registration.
5. **Choose the cave-shell workflow.** Prefer an authored, optimized shell over procedural rock scatter. Define GLB segmentation, LOD, texture compression, lightmaps or runtime lighting, collision proxies, and portal/streaming boundaries.
6. **Write the exhibit program.** Decide what the visitor can inspect or use in Water beyond watching the automaton. Then reserve real floor and wall area for those objects.
7. **Design audio with the room.** Establish fire/water/air ambience, prop movement, automaton mechanics if audible, and cross-room attenuation before multiplying chambers.
8. **Build and visually review Water.** Verify at walking speed and across required viewports. A green typecheck is necessary but not sufficient.
9. **Propagate only after approval.** Convert the approved Water solution into a reusable habitat contract, then author Fire, Earth, Air, Sun, and Moon as distinct spaces rather than palette swaps.
10. **Reassess total route length.** Austen previously worried that six rooms might be too many. Keep six solo performers unless he changes that decision, but test the full-scale route before filling all six with final assets. If the path drags, solve pacing and transitions first; do not silently remove performers or create ensemble sightlines.

## Decisions already made

- Current production is web prototype first in Svelte, Threlte, Three.js, and Rapier. Do not redirect the task to UE5.
- There are six dedicated solo cave automatons: Water, Fire, Earth, Air, Sun, and Moon.
- They never read as an ensemble. Sightlines and acoustic zones must keep each encounter isolated.
- The main route remains linear and chronological.
- The cave aims for awe, not horror.
- Chamber differences are felt through architecture, material, sound, and movement. Visitor-facing labels do not announce the elemental or celestial mapping.
- Cave pictographs remain pre-alphabetic. Do not show Latin letter names.
- Costumes are serious and the museum commits to the fiction.
- The 2026-08-02 implementation is rejected as an art and scale target.
- Each chamber must provide a public exhibit zone and a gated or architecturally separated recessed habitat.
- Performers must read as prehistoric humans or representations of them within those habitats.
- Performance props must be bespoke period-appropriate sticks or torches, not standard TKA practice props.
- One chamber reaches the intended quality and receives approval before the other five are built from it.

## Gotchas

- The worktree is heavily dirty with unrelated Agent Hub, CAPS, gallery, and other concurrent changes. Do not revert, stage, or commit files outside the exact museum scope.
- `main` had three unrelated local commits ahead of `origin/main` when this handoff was committed: `9049414bf2`, `a6b4da841c`, and `e4863b030a`. This handoff adds another commit on top. Do not push it if doing so would publish someone else's commits without confirming their ownership.
- The cave code is uncommitted. Use explicit pathspecs for any future commit. Never use `git add .`, `git add -A`, or a bare `git commit`.
- The active floor-plan spec was corrected in place because its original small-room language is unsafe. Read the 2026-08-02 live-review correction before using the rest of that document.
- `MuseumPerformerStation3D.svelte` chooses normal prop types from sequence or user settings and falls back to `PropType.STAFF`. That behavior is directly contrary to the cave-prop requirement.
- `Museum3DScene.svelte` currently contains a direct cave scenic-layer import. Avoid compounding this generic-scene coupling.
- Existing low-poly cave and vegetation assets are useful for layout tests, not automatically acceptable as final art.
- Six large habitats can become a long, expensive route. Portal streaming and a visitor-spine layout are likely necessary, but room count stays six unless Austen changes it.
- Browser interaction requires the repository's shared Chrome process and current permission rules. Visual verification is mandatory after implementation; preserve the task-owned-tab discipline.
- Domain claims and any sequence changes require `flow-arts` MCP evidence.

## Post-handoff direction (2026-08-02, Austen, after review of this handoff)

- **Scene reuse means systems and atmosphere tech, not wholesale scenes.**
  Confirmed intention: pull the proven engines from existing 3D scenes into the
  habitat bays — the ocean scene's water shaders/caustics for Water, Ember's
  fire/ember particle systems for Fire, lunar lighting language for Moon,
  forest (or possibly desert) vocabulary for Earth — while keeping the
  continuous cave fiction, gates, and habitat program of this handoff.
- **Immersive thresholds are wanted.** "I do love the idea of walking into a
  room and suddenly being underwater somehow" — design each bay's approach as
  a transition chamber the visitor passes through, compatible with the
  approach/occlusion layer already specified above.
- **Pedagogical arc across the six rooms.** By the time the visitor exits the
  sixth room they should clearly understand the six modes, having been shown
  each mode's letter variations as hand paths in that mode's room — e.g. Water
  presents A, B, C; Earth presents G, H, I. The concepts should feel clear by
  accumulation. (Letter↔mode groupings must be verified through the flow-arts
  MCP at spec time, per standing rules; the pictographs themselves stay
  pre-alphabetic per the decisions above — presentation must not print Latin
  letter names on cave walls.)
- **One room at a time stands.** Austen explicitly endorsed the vertical-slice
  sequencing; do not broad-brush all six rooms at once.

## Verification method for the rebuild

Before calling the vertical slice done, provide all of the following in the same work session:

1. Focused floor-plan and presentation tests for connectivity, performer ownership, collision, sightline/portal rules, and asset descriptors.
2. Relevant TypeScript and Svelte checks with zero new errors.
3. A clean runtime console and a successful HTTP response for the cave route.
4. First-person screenshots at 1920x1080, 2560x1440, 3840x2160, 1440x900, 820x1180, 960x412, and 375x667.
5. A short capture or sequence of screenshots proving approach, gate reveal, multiple viewing positions, prop registration through motion, and exit occlusion.
6. Measured evidence for public circulation width, performer clearance, barrier placement, and habitat depth.
7. Asset license and attribution records for every external model, texture, audio source, or animation.
8. Austen's explicit visual approval of Water before propagating the habitat system.
