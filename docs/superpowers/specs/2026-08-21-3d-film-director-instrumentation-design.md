# 3D film director instrumentation

**Status:** First directing instrument and proof film implemented  
**Private route:** `/test/film-director`  
**Public Composer page:** unchanged by this work

## What this is for

Austen should be able to describe a scene in ordinary language, including the cast, props, formation, effects, movement timing, environment, and camera move. Codex translates that direction into one versioned scene description, opens it in the real 3D viewer, and fills in details Austen did not specify with visible, repeatable defaults.

The working loop is:

1. Austen describes a shot or short film.
2. Codex writes the version 1 scene description.
3. The private viewer validates every requested asset and setting before changing the scene.
4. Austen watches the result and directs the next pass.
5. An approved film can later be handed to the capture system without rewriting its creative direction.

The directing description owns the creative choices. The production 3D viewer still owns rendering, avatars, props, environments, effects, formations, and camera controls. This avoids creating a second, marketing-only version of the app.

## Why the description is shaped this way

The structure follows established production formats without copying their machinery. OpenTimelineIO separates a timeline into clips, time ranges, and transitions. glTF keeps cameras and animated properties explicit. Theatre.js places changing values on a sequence of keyframes. Blender's Follow Path model keeps camera movement separate from what the camera looks at. The existing TKA viewer already uses `camera-controls`, so the director feeds its camera rather than adding another camera system.

References:

- [OpenTimelineIO concepts](https://opentimelineio.readthedocs.io/en/latest/index.html)
- [OpenTimelineIO time ranges](https://opentimelineio.readthedocs.io/en/v0.18.1/tutorials/time-ranges.html)
- [glTF 2.0 cameras and animation](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [Theatre.js sequences](https://www.theatrejs.com/docs/latest/manual/sequences)
- [Blender Follow Path constraint](https://docs.blender.org/manual/en/3.6/animation/constraints/relationship/follow_path.html)
- [`camera-controls`](https://github.com/yomotsu/camera-controls)

## The version 1 scene description

A film contains an output frame, playback rules, and one or more shots. Each shot can describe:

- duration and transition;
- environment, stage, audience, and available scene features;
- performers, deployed avatars, props, efforts, facing, staff lengths, and count offsets;
- a preset or custom formation;
- named effect presets plus specific effect adjustments;
- tempo and sequence playback;
- a camera preset or custom camera keyframes with position, target, lens, interpolation, and easing.

A short valid example looks like this:

```json
{
  "version": 1,
  "id": "forest-trio",
  "title": "Forest trio",
  "shots": [
    {
      "id": "hero",
      "title": "Sword lead",
      "durationSeconds": 8,
      "scene": { "environmentId": "forest" },
      "performance": {
        "formation": "custom",
        "performers": [
          { "prop": "sword", "position": { "x": 0, "z": -1 } },
          { "prop": "staff", "position": { "x": -2, "z": 1 } },
          { "prop": "staff", "position": { "x": 2, "z": 1 } }
        ]
      },
      "effectPresets": { "fire": "classic" },
      "camera": { "preset": "hero-dolly-in" }
    }
  ]
}
```

If a brief leaves something open, the director chooses from deployed material. It rotates through the current avatar catalog, assigns staffs and linear effort, chooses a formation that fits the cast size, infers the ocean for bubbles, selects a group camera for a large cast, and uses a close camera for a small cast. The result is deterministic: opening the same description produces the same scene.

Unknown avatars, environments, effects, presets, props, or impossible formations fail before the viewer changes. The editor reports the first few problems in plain language and preserves the last valid scene.

## First proof film

`Sky is the Limit` runs for 37 seconds and exercises four distinct arrangements:

1. Eight performers from a recurring three-person company in an autumn circle, with staffs, fire, glide effort, and a group orbit.
2. A sword lead in front of two staff performers in a forest, with a camera move toward the lead's face.
3. Two triad performers and two club performers in the ocean, with bubbles and a high reveal.
4. Eight club performers in a tunnel formation, each one count behind the performer ahead, while the camera moves from the front to the side.

It deliberately uses only assets and controls that are currently deployed. There is no astronaut, zombie setting, or moon environment in this proof because those requests are not available in the current catalogs.

## Capability truth

| Status                                | Capability                                                                                                       | Evidence or limit                                                                                                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Works now                             | A written film controls real 3D scenes                                                                           | The private route renders through `Viewer3DCanvas`; no stand-in renderer was added.                                                                                                                                  |
| Works now                             | Scene changes do not inherit account settings                                                                    | Viewer, effects, and scene-feature state are created without persistence for this route.                                                                                                                             |
| Works now                             | Cast, avatars, props, efforts, facing, formation, stage placement, environments, and effects can change per shot | The four-shot proof changes each of these across the film.                                                                                                                                                           |
| Works now                             | Performers can be offset by individual counts                                                                    | The celestial shot uses offsets from 0 through -7; seam wrapping has focused tests.                                                                                                                                  |
| Works now                             | Cameras can use presets or authored paths                                                                        | Position, target, and lens are sampled on the film clock. Portrait previews widen the preview lens without changing the authored output lens.                                                                        |
| Works now                             | Scene descriptions are checked before applying                                                                   | Invalid JSON and unknown catalog entries leave the last valid scene intact.                                                                                                                                          |
| Works now                             | The directing screen fits phone, short wide screens, tablet, desktop, and native 4K widths                       | Verified at 375, 960×412, tablet, 1440, 1920, 2560, and 3840 widths.                                                                                                                                                 |
| Built but not an exported deliverable | The full 37-second film plays in the viewer                                                                      | Playback is live in the browser. It does not yet produce a video file.                                                                                                                                               |
| Works now                             | Prepared environment cuts                                                                                        | The opening pass loads and renders each world. Later cuts keep the complete outgoing picture opaque while the retained incoming world, cast, camera, effects, and post-processing settle behind it.                  |
| Partial                               | True two-world cross-dissolves                                                                                   | Environment dissolves blend a captured outgoing frame over the live incoming shot. The incoming camera and performance move during the dissolve; the outgoing side is a still rather than a second live render pass. |
| Partial                               | Sequence choice                                                                                                  | The instrument currently drives the deployed demo sequence. Loading arbitrary saved or generated sequences is a separate connection.                                                                                 |
| Partial                               | Every environment feature toggle                                                                                 | Existing environments do not all interpret stage and scene-feature controls in the same way. The director can request them, but the environment remains the final authority.                                         |
| Partial                               | Every effect control                                                                                             | Named deployed presets and shallow effect adjustments work in JSON. A visual control panel for every effect setting is not part of this instrument.                                                                  |
| Unavailable                           | Automated video capture and encoding                                                                             | No frame recorder or export job was added.                                                                                                                                                                           |
| Unavailable                           | Assets or behaviors absent from deployed catalogs                                                                | The director rejects examples such as an astronaut avatar instead of pretending they shipped.                                                                                                                        |

## Transition instrument

Every environment cut records one profile from the transition owner rather than guessing from button clicks. The profiler starts before the hidden scene mutation, so the expensive work is included even though the audience never sees it. The profile includes:

- the source and destination world;
- time spent switching the retained world and waiting for scene and shader readiness;
- the largest animation-frame gap and the number of gaps over 100 ms;
- the number, total time, and worst duration of browser long tasks;
- resources requested after the cut began and their transferred bytes.

Development builds log each completed profile as `[FilmDirector] environment transition`. The current profile and completed profiles are also available at `window.__tkaFilmDirectorTransitions` for browser traces and repeatable comparisons. Resource timing is cleared at the start of each cut so the list describes that cut, not the whole page load.

The visual edit has one owner. Environment dissolves capture the last complete outgoing WebGL frame, commit it to the screen, then change the scene underneath. The captured frame stays fully opaque until the incoming composition has reported ready and survived two paints. Its opacity then falls monotonically while the incoming shot is already moving. A fade-through-black uses the same full-frame black overlay on both sides of the boundary and holds the playhead at full black while the incoming frame settles. The ordinary environment veil and its performer-only redraw are disabled for this film host.

## Ownership and affected files

The private directing route lives under `src/routes/test/film-director/**`. Its route-local files own the schema, defaults, validation, camera tracks, timeline sampling, proof film, controls, and layout.

The shared viewer changes are opt-in. Ordinary 3D viewers keep their current scene lifecycle. The film route opts into retained environments, a stable performer pool, and keyed render warm-up:

- `src/lib/shared/3d/domain/performer-step-timing.ts`
- `src/lib/shared/3d/components/Viewer3DCanvas.svelte`
- `src/lib/shared/3d/components/Viewer3DScene.svelte`
- `src/lib/shared/3d/components/SceneShaderWarmup.svelte`
- `src/lib/shared/3d/environments/components/Environment3D.svelte`
- the autumn, forest, ocean, and celestial scene owners used by the proof film

The ocean keeps its parsed flora and fish models plus its renderer-specific image lighting alive. The forest, autumn, and celestial GLB roots remain owned by Threlte's existing cache. Retained worlds stay mounted but hidden, so returning to one does not reconstruct its scene tree.

`src/config/domains.ts` recognizes the private route as a standalone development instrument. Focused tests live in `tests/unit/film-director/**` and `tests/unit/3d-viewer/performer-step-timing.test.ts`.

No public Composer route, shared launchpad, `SiteHeader`, or `SiteFooter` was changed.

## Risks before footage production

- The opening preparation cost varies with browser and GPU cache state. That is a deliberate upfront trade: the audience sees one honest preparation screen instead of performers, props, and fire arriving in pieces during the film.
- Four retained worlds use more CPU and GPU memory than one disposable world. The film route needs a memory ceiling before longer films or more environments are admitted.
- Hidden worlds no longer draw, but their background animation tasks remain registered. A longer film should add one shared active-world signal before retaining more than this four-world proof.
- Browser playback follows real time. A capture job needs a deterministic frame clock so slow frames never alter the final timing.
- A high performer count with several effects can be expensive at native 4K. Capture should render fixed frames rather than record an overloaded live tab.
- Environment stage controls need one shared contract before a film depends on hiding or replacing stage geometry in every scene.
- Camera paths are mathematically smooth, but every shot still needs an approval pass for framing, occlusion, and visual rhythm.
- An environment dissolve uses a still for the outgoing half. A future dual-render capture pipeline could keep both sides moving, but the current approach is honest about that limit and prevents construction frames from reaching the screen.
- New creative requests must stay honest. Missing assets should enter the asset pipeline or be replaced with an approved deployed choice.

## Verification completed

- Focused unit run: 6 files passed, 24 tests passed.
- Runtime proof: all four shots loaded real environment and avatar assets; the final shot displayed all eight performers at 32 seconds with the camera at its side position.
- First-load integrity proof: a foreground load on a warmed development server finished the full two-pass preparation in about 15.5 seconds. A browser-cache-bypassed pass finished in about 17 seconds. The proof film downloads three recurring cast models (about 6.1 MiB total) instead of eight unique models (about 25.9 MiB), skips unused locomotion assets for stationary performers, and caps ensemble effects with the existing quality tiers.
- Reveal integrity proof: the first-load curtain remained in front of the stage through avatar preparation, so props and fire could not appear without their performers. All later shots reused the same three cast assets and requested no locomotion pack.
- Failed visual acceptance: the first timing pass reported shorter cuts but left the environment veil and editorial fade competing. It also redrew performers above the veil. Those numbers did not prove a smooth edit, and Austen correctly rejected the result after seeing performers and props hang over half-built worlds.
- Full-frame dissolve proof: the autumn-to-forest cut held the film clock at the boundary while the captured autumn frame remained at opacity 1. The incoming clock resumed before the first visible forest frame, and the outgoing opacity then fell monotonically from 1 to 0 over the authored dissolve. Frame inspection showed a real blend of the complete autumn and forest pictures, not a world-only veil with exposed performers.
- Fade-through-black proof: ocean faded monotonically from clear to 99.98% black, the playhead held at 27.00 seconds while celestial settled, and the same overlay then fell monotonically back to clear. The snapshot layer remained hidden throughout, so no second fade fought the edit.
- Manual navigation proof: selecting the celestial shot outside its timeline fade used the captured-frame dissolve fallback; opacity again moved monotonically from 1 to 0 instead of exposing the atomic world switch.
- Hidden preparation profile: a warmed autumn-to-forest switch settled behind the captured frame in 75 ms; forest-to-ocean settled in 129 ms. The largest measured frame gap was 25.9 ms, neither cut produced a gap over 100 ms, and both requested zero resources.
- Invalid description proof: `{}` was rejected with `version must be 1. id is required. title is required. 1 more issue.` Reset restored the approved film and cleared the error.
- Responsive proof: the preparation screen and prepared viewer were inspected at 375, 960×412, tablet, 1440, 1920, 2560, and 3840 widths. No page overflow was introduced.

The next production phase is a fixed-frame capture and encoding path. It should consume this same approved film description, expose approval checkpoints per shot, and output a repeatable master video plus smaller marketing variants.
