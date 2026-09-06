# Blossom lantern garden

Replacement for the rejected moonlit amphitheatre. Austen authorized a complete redesign and direct work in the primary checkout in the September 5 handoff. He subsequently gave the lantern-garden composition a visual pass, with two remaining ground-cover concerns: the outer vegetation boundary and the mismatch between grass and soil.

The garden uses a rounded 12 × 8 m slate court, a continuous stone apron and approaches, broad front steps, a crescent pond, eight low washi lanterns, four lanterns hung from sampled branch positions, planted rock banks and 26 botanical cherry trees. A 17 m main tree anchors the pond. The protected performance volume and two circulation routes remain part of the authored plan.

## Reproduction

Run from the repository root, sequentially:

```powershell
$env:BLOSSOM_SKIP_RENDER='1'
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --factory-startup --threads 6 --python scripts/build-blossom-lantern-garden.py
node scripts/optimize-blossom-glb.mjs
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --factory-startup --threads 6 --python scripts/verify-blossom-lantern-garden.py
node scripts/verify-blossom-composition.mjs
```

The builder saves `blender/blossom/lantern-garden.blend`, an ignored editable source. `scripts/blender-export-blossom-full.py` exports subsequent Blender edits. Runtime code imports `src/lib/shared/3d/environments/scenes/cherry-blossom/blossom-plan.json`; the builder mirrors it to the public `amphitheatre-plan.json`. The verifier checks that both copies match. Public plan and manifest filenames retain their historical names, but their contents identify the lantern garden.

## Source assets

Botanical branches and the cherry flower atlas come from the existing `blossom-plantfactory-family-r1` family, with licensing recorded in `scripts/blossom-plantfactory-family.json`. The builder reconstructs full-UV blossom cards instead of retaining elongated oak leaf polygons. Project moss, stone and bark maps are packed into the GLB. This is an embedded scene, not a standalone redistribution of the PlantFactory source library.

`composition-reference.png` is generated concept art. It is a composition target, not a screenshot of the implemented scene. Runtime screenshots are labelled separately.

## Verification

- 75 focused tests pass across ten suites, including court bounds, material borrowing and disposal, quality tiers, water coordinates, production contracts, opening cameras, welcome transitions, selection scope and performer facing. One pre-existing Ember test remains a TODO.
- Focused ESLint checks pass for the changed scene modules. The shared viewer state file retains three pre-existing lint errors outside this change.
- Actual Blender vertex checks pass for 56 relevant meshes: no roots in the pond, no objects in the performance volume, and clear approaches between 0.25 m and 2.4 m above walking grade. Both approach grades remain below 3.51%.
- The optimized export is 12.82 MiB, with 3,367,696 authored visible triangles. Four near trees preserve individual shadow ownership; the remaining grove uses shared GPU instances.
- These are sampled geometry checks, not collision certification. The legacy audience target of 48 remains unvalidated.

See the evidence directory for the geometry and delivery reports. Browser review is recorded separately from these technical checks.

## Browser review — September 5, 2026

Reviewed revision `e236eddb79` through a clean, isolated Vite server at `/test/viewer-3d?scene=blossom&perf=1`. Checked 375×667, 390×844, 844×390, 768×1024, 1440×1000, 1920×1080 and 3840×2160. The 4K DOM and canvas dimensions were confirmed, but the native screenshot clips the bottom and right edges; it is partial visual evidence. All other captures show the full viewport. Approach and reverse-shore views show the court's connection to the paths and the separation of trees from water.

Fresh startup exposed an invalid import from Vite's public directory; the bundled source plan fixes it. Portrait review then exposed a camera inside the outer grove; the final angled portrait camera avoids that obstruction. Both fixes were checked in the browser after committing them.

`runtime-overview.jpg` and `runtime-fullhd.jpg` show the final desktop composition. `runtime-phone-375.jpg`, `runtime-phone-390.jpg` and `runtime-tablet.jpg` show the authored portrait view. `runtime-low-reduced.jpg` uses a two-core hardware hint and reduced-motion preference: draw calls fell from roughly 164 to 61 and submitted triangles from 7.42M to 3.34M. This mode sacrifices shadows and the brighter lighting treatment.

Recorded frame-rate snapshots range from 22 to 60 FPS on the shared development machine. These samples include startup and concurrent work; they do not establish production or physical-phone performance. Existing Svelte state-proxy equality warnings remain. Raw measurements and scope limitations are in `evidence/viewport-observations.json`.

This initial review preceded Austen's visual pass and the ground-cover refinement below. Mobile performance still needs a controlled physical-device benchmark. `rejected-early-blender-study.png` is retained as a rejected study, not final evidence.

The temporary server on port 5491 was stopped. Git removed the detached review worktree registration, but its folder could not be completely removed because it contained a dependency junction. Automatic approval review blocked the subsequent checked cleanup command with “blocked by policy.” The remaining folder is `E:/worktrees/tka-platform/blossom-final-review-905`. During the ground follow-up, missing dependency launchers and metadata were discovered, likely affected by that removal. `pnpm install --offline --frozen-lockfile --ignore-scripts` restored them without changing the lockfile. No further folder cleanup was attempted.

## Ground-cover refinement

The authored vegetation previously ended inside a 72×66 m rectangle on a 144×144 m terrain. Fine meadow blades now extend to roughly ±71 m, with density decreasing gradually across the outer ground. Blades are roughly 1–3 cm wide instead of 9–20 cm, with shorter heights and darker roots. Moss receives a matching olive tint, reduced normal strength and a low specular factor; this prevents the grazing-angle moonlight from washing the ground grey.

The refined asset is 11.69 MiB with 3,299,708 visible authored triangles, both slightly below the accepted version. Geometry clearance checks still pass and now verify the outer ground-cover bounds. The asset verifier also checks that the matte moss treatment survives export. Ten focused runtime and composition tests pass, along with the scene module's ESLint check. Browser evidence for this follow-up is prefixed `ground-refinement-`; the earlier `runtime-` captures document the accepted composition before this refinement. This follow-up reused port 5173 and started no additional server.

The shared opening-camera owner now uses the authored Blossom view when no neighboring 2D card needs alignment. The single-performer welcome transition preserves this composition; larger casts retain their group framing. Portrait screens use a wider, offset composition. Blossom's performer heading follows its reversed stage axis, and the worker renderer receives the same authored opening pose. Saved user camera poses continue to take precedence.
