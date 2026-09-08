# Character playground

`/test/character-playground` replaces the retired Avatar Bake Off. Old links redirect, preserving the chosen character when its file is available.

The page mounts `Viewer3DCanvas` with an isolated, seeded viewer state. It uses the production performer rig, prop rendering, grid and environments. The app's `AnimationPlaybackController` supplies the fractional playhead, with ephemeral animation and visibility state so playback controls do not change saved preferences. Examples come from the verified combination fixtures. Character selection registers existing local intake files in the scene catalog before mounting the renderer. The page requests the main-thread backend because these local definitions are not shipped to the worker catalog.

## Local MPFB generation

Randomize runs Blender locally, then routes the result through `character-intake.mjs` for normalization, optimization, rig checks, provenance and staging. The current performer keeps playing during generation. A successful character is selected and kept in the local manifest, so it remains available after reload. Missing models and rejected Marcus entries stay out of the picker.

`scripts/characters/mpfb-proof.py --seed <integer>` uses MPFB's randomization service for adult body macros and symmetric facial targets. It selects fitted clothing, skin and hair from the official CC0 system assets. It preserves the proof's finger bone-roll correction and bakes evaluated shape keys before applying export masks. The seed, macros, detail targets and chosen assets are recorded in `generation.json`; the editable Blender source is saved alongside the raw GLB.

The generation endpoint is restricted to development, loopback clients, local hostnames and same-origin POST requests. It accepts no client paths or shell commands. A filesystem lock permits one generation across tabs, HMR and task servers. Blender has a two-minute timeout; ordinary failures release the lock and leave the current character usable.

Defaults use the existing installation at `E:/3D-Models/mpfb-proof-20260908`. Override with `MPFB_HOME`, `MPFB_SOURCE`, `MPFB_ASSETS`, `MPFB_OUTPUT` and `BLENDER_BIN` when using another installation. Output defaults to `<MPFB_HOME>/playground`; runtime GLBs and the intake manifest remain under ignored `static/models/avatars/bakeoff` for compatibility with the intake pipeline. These are local evaluation files, not deployed assets.

If the entire dev server is forcibly killed during generation, inspect `playground/generation.lock` and its recorded job directory before removing a stale lock. Do not remove the lock while its Blender process is still running.

## Scope of the result

The playground enables the rig's existing palm attachment (`weldGrip`) through the production viewer. The older attachment clamped corrections to six centimeters, which left a visible gap on some generated bodies. This opt-in follows the achieved palm and knuckle line and requires the main-thread renderer. Other viewer hosts retain their existing setting.

Randomization varies geometry, facial proportions, presentation, skin, hair and outfits. This is the authored MakeHuman mesh and rig pipeline, not an AI image-to-mesh service. Finger bones are present and bend toward the palm, but precise thumb and staff contact still need refinement. Generation does not automatically promote a character into the production catalog.

## Verification, September 8, 2026

- 27 focused tests pass for candidate availability, rejected entries and generation request boundaries, concurrency and failure cleanup. `npm run check` reports no errors or warnings.
- Seeds 1, 7 and 42 were generated through the CLI; seed 2120506931 was created and selected through the browser's Randomize button in 10.6 seconds. Each passed intake and retained all 30 finger bones.
- Browser inspection exercised playback, pause, half speed, sequence switching, character switching, grid visibility and hand/body framing. The initial floating-prop defect reproduced in this viewer and the existing palm attachment removed the visible gap.
- All seven prescribed CSS viewport sizes reported no horizontal overflow and controls retained 44px targets. The in-app browser's emulated screenshots showed stale compositor fragments outside the current layout, so those captures do not establish pixel-perfect rendering at every size. Normal viewport inspection was used to judge the character and grip. Temporary viewport and page-scale overrides were cleared.
