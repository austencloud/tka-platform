# Cinematic Winter Snow Volume

Status: Design specification. Implementation requires explicit approval after
the current shared-package overlap is resolved.

## Outcome

Turn the existing 2D snowfall into a convincing volume of snow around the
viewer. Distant powder, detailed middle-distance crystals, and large soft
foreground flakes must occupy distinct visual depths while remaining part of
one continuous wind field.

Snow remains the subject. The scene gains no horizon, snowbank, terrain, trees,
animal, building, or other scenic object. The fixed winter sky remains behind
the snow.

The result should feel like standing inside snowfall rather than watching
snowflake symbols travel across a screen.

## Current gap

The living-winter pass already provides the correct mechanical foundation:

- one coherent curl-and-gust wind field;
- depth-scaled particle response;
- pointer wakes;
- eased pointer parallax;
- a snow-only cursor light;
- restrained glints;
- touch flattening and reduced-motion behavior.

Every flake is still rendered with the same crisp stroked `Path2D` language.
Size, opacity, and parallax vary by depth, but focus does not. A close flake and
a distant flake therefore look like scaled versions of the same mark.

Autumn's current 2D treatment exposes the difference. It moves separate far,
middle, and near art planes through one shared `DepthParallaxTracker`. Winter
already uses that tracker in the current shared-package working tree, but it
has only one optical treatment.

## Creative contract

### Three readable snow bands

Each particle receives one stable optical class when it is created. The class
does not change while the particle crosses the viewport.

| Band       | Visual treatment                               | Motion character                     | High-quality share |
| ---------- | ---------------------------------------------- | ------------------------------------ | -----------------: |
| Powder     | Tiny soft grains with low contrast             | Slow, broad flow                     |          50 to 58% |
| Crystal    | Current detailed six-point flakes              | Clear falling and tumbling           |          32 to 40% |
| Foreground | Large, translucent, partially defocused flakes | Strongest parallax and gust response |           8 to 12% |

The percentage ranges describe the population, not equal visual weight.
Foreground snow must remain sparse.

### Powder

- Powder ranges from roughly 0.6 to 2.2 CSS pixels at a 1x backing scale.
- It uses low opacity and cool gray-blue values rather than pure white.
- Powder may batch into a small number of paths by opacity bucket.
- Neighboring powder particles must reveal the broad wind field without
  forming obvious rows, clumps, or repeating waves.
- During a gust, powder stretches only enough to reveal direction. It must not
  turn into rain.

### Middle-distance crystals

- Preserve the current procedural six-point crystal family and its stable
  per-particle shape.
- Keep the cursor-light facet response and rare glints.
- Maintain crisp centers and delicate branches at normal display scale.
- Rotation, brightness, and branch geometry remain stable from frame to frame.
- A broken optics asset must never remove this band.

### Foreground snow

- Foreground flakes range from roughly 20 to 84 CSS pixels on wide desktop
  viewports and 16 to 48 CSS pixels on narrow screens.
- Their edges are soft, but their internal structure remains faintly readable.
  They must not resemble soap bubbles, lens dust, flower petals, or fog discs.
- Most enter through the outer 22 percent of the viewport. A small minority may
  cross the central field so the depth does not look staged.
- A flake may begin partly outside the viewport. Clipping at the screen edge is
  desirable because it implies a larger object passing close to the viewer.
- Foreground opacity stays low enough that one particle cannot hide a control,
  pictograph, or face for more than a brief moment.
- No more than 14 foreground flakes may be active on a wide high-quality
  viewport. Portrait high quality caps at 8.

### The frame still breathes

The existing automatic gust schedule remains the weather clock. No second
random weather scheduler is added.

The visual bands respond to the same gust front:

- powder makes the leading edge readable;
- crystals tilt and accelerate with the current smoothed velocity;
- foreground flakes travel farther and brighten less than hero crystals;
- the field returns to its calm distribution without a visible population
  jump.

Particle count must not spike when a gust begins. The squall is revealed by
motion, optical depth, and existing particles crossing at different speeds.

## Composition and legibility

The background serves screens with very different content placement. It cannot
reserve one hard-coded empty rectangle.

- Distant powder and middle crystals may use the full viewport.
- Large foreground births favor the outer frame.
- The middle 46 percent of the viewport width receives at most 35 percent of
  foreground births over a long deterministic sample.
- Edge bias must not produce empty vertical lanes or a visible rectangular
  mask.
- The fixed gradient remains untouched by parallax and cursor light.
- The cursor light illuminates snow only. No circular halo may appear on the
  sky.
- Shooting stars remain available and keep their existing quality gate. The
  snow-volume work does not add another celestial effect.

## Optical asset

Create one original transparent WebP atlas for near-field snow optics:

`static/images/backgrounds/winter/snow-optics.webp`

The atlas contains at least eight distinct crystal silhouettes across crisp,
half-focus, and soft-focus cells. It must include no text, border, background
color, stock imagery, or externally licensed material.

Atlas requirements:

- maximum dimensions: 1024 by 1024 pixels;
- compressed file size target: 512 KiB or less;
- alpha around every cell must be clean at dark and light winter values;
- cell geometry and source rectangles live in one typed winter-owned module;
- the same crystal must not appear in adjacent focus cells with mismatched
  rotation or branch structure;
- medium and high quality decode the atlas once;
- low quality does not request it.

The current procedural `Path2D` renderer is the loading and failure fallback.
Until the image is decoded, the scene remains complete and animated.

Runtime `ctx.filter` and per-particle `shadowBlur` are prohibited. Blur is
baked into the atlas. This avoids a 4K blur pass for every foreground flake and
does not depend on the uneven browser support of
`CanvasRenderingContext2D.filter`.

## Capability ownership

### Extend

`SnowflakeSystem` continues to own:

- particle creation and recycling;
- position, velocity, rotation, and wind integration;
- quality-dependent population;
- pointer wake input;
- resize distribution;
- reduced-motion state.

It gains stable optical metadata and delegates drawing to one winter renderer.

### Reuse

- Reuse `DepthParallaxTracker` for all three snow bands. Do not restore or
  recreate `WinterParallaxTracker`.
- Reuse `WinterWindField`; no second force field or gust scheduler is allowed.
- Reuse `WinterCursorLightTracker`; it remains the only cursor-light owner.
- Follow the `FishSpriteManager` and tree-rendering convention for decoded or
  offscreen image caching and HTML canvas fallback behavior.

### Create

Create `SnowVolumeRenderer` as the sole owner of snow focus-band drawing. The
name states what the class does and avoids a generic `Service` or `Manager`
suffix.

`SnowVolumeRenderer` owns:

- optics-atlas loading and cell lookup;
- powder batching;
- crystal, powder, and foreground draw treatments;
- quality-specific optical features;
- fallback rendering when the atlas is unavailable;
- render statistics needed for verification.

It does not own particle motion, wind, parallax input, pointer tracking, or
quality selection.

### Discovery evidence

Internal searches covered `sprite atlas`, `texture atlas`, `OffscreenCanvas`,
`shadowBlur`, `Path2D`, `parallax`, and `focus`.

Closest owners:

- `FishSpriteManager` owns reusable offscreen fish sprite creation.
- Forest and Blossom tree systems cache expensive static drawing work.
- `DepthParallaxTracker` owns shared pointer viewpoint behavior.
- Autumn owns art-plane parallax, not snow optics.
- `SnowflakeSystem` owns winter particle physics and current drawing.

No existing owner renders focus-separated snow. `SnowVolumeRenderer` is a new
winter presentation owner, not a parallel particle system.

No external runtime dependency is needed. Canvas 2D already supplies the
required image cropping, alpha compositing, rotation, and scaling.

## Data model

Extend `Snowflake` with stable visual data assigned only during creation:

```ts
type SnowOpticalClass = "powder" | "crystal" | "foreground";

interface SnowOpticalProfile {
  class: SnowOpticalClass;
  variant: number;
  focus: number;
  renderScale: number;
}
```

The final field names may follow the surrounding model style, but the contract
is fixed:

- no random choice occurs inside `draw`;
- `variant` stays within the atlas or procedural-variant bounds;
- `focus` is clamped from 0 to 1;
- `renderScale` is finite and positive;
- depth remains the source for wind and parallax response;
- optical class survives resize and ordinary recycling.

Use one seeded or injected random source in pure classification helpers so
distribution tests are deterministic. Do not introduce a global seeded-random
framework.

## Rendering path

1. `WinterBackgroundSystem` draws the fixed gradient.
2. `SnowflakeSystem` updates every particle through `WinterWindField`.
3. `DepthParallaxTracker` resolves the draw offset from the particle depth.
4. `WinterCursorLightTracker` resolves snow-only light intensity.
5. `SnowVolumeRenderer` draws powder back to front, then crystals, then
   foreground optics.
6. The existing shooting-star pass retains its current ordering unless visual
   review proves a specific overlap is wrong.

The renderer may build batched powder paths each frame. It may not allocate a
new canvas, image, gradient, `Path2D`, or atlas structure during the frame loop.

Foreground atlas cells use `drawImage` source rectangles. Nonuniform scaling
may express mild gust motion, but the long axis may not exceed 1.35 times the
short axis. This cap prevents snow from becoming streaked rain.

## Pointer light by band

- Powder receives a broad, faint lift with no glint rays.
- Crystals retain the current facet response and rare sharp glints.
- Foreground snow receives a soft alpha lift. It does not receive sharp glint
  crosses because a defocused object cannot produce a crisp screen-space star.
- Light intensity falls with distance from the pointer and with optical depth.
- At zero resolved light intensity, the renderer must not enter additive
  compositing for that particle.

## Accessibility and input

### Touch

Touch keeps the three-band composition but disables pointer parallax and
cursor light. Touch movement must not disturb the wind field.

### Reduced motion

Reduced motion:

- disables pointer parallax, cursor wakes, automatic gusts, and cursor light;
- removes foreground flakes;
- retains a sparse powder and crystal fall with the existing faint ambient
  drift;
- resets any active foreground contribution immediately when enabled.

### Mouse and pen

Mouse and pen receive the complete treatment. Pen input follows the same
parallax and light behavior as mouse input. Pointer speed may influence the
existing wake, but it does not change optical-class population.

## Quality tiers

| Feature             | High                       | Medium                    | Low                   |
| ------------------- | -------------------------- | ------------------------- | --------------------- |
| Powder              | Full                       | Reduced                   | Reduced simple grains |
| Procedural crystals | Full                       | Full                      | Current renderer      |
| Foreground optics   | Up to 14 wide / 8 portrait | Up to 6 wide / 4 portrait | Off                   |
| Optics atlas        | Loaded                     | Loaded                    | Not requested         |
| Cursor glints       | Current rate               | Reduced rate              | Off                   |
| Gust stretch        | Full capped treatment      | Crystal and powder only   | Off                   |

Thumbnail mode, if present at the controller boundary, disables foreground
optics and uses a stable calm frame. The implementation must not add a separate
thumbnail renderer.

## Performance contract

At 3840 by 2160 with high quality after a five-second warm-up:

- average winter `update + draw` time is at most 2.0 ms on the development
  machine;
- p95 `update + draw` time is at most 4.0 ms;
- frame-time sampling runs for at least 600 frames;
- no per-frame canvas or image allocation occurs;
- no runtime blur filter is used;
- atlas decode occurs once per system lifetime;
- particle values remain finite through a gust, pointer wake, resize, and
  quality change.

If the budget fails, reduce foreground count and powder batching cost before
removing the three-band composition.

## Failure behavior

- Atlas loading failure keeps procedural snowfall visible.
- `getMetrics()` reports one warning while the atlas is loading and a distinct
  warning after a confirmed load failure.
- A retry may occur after an aspect-neutral system reinitialization, but not on
  every frame.
- Invalid atlas-cell metadata falls back to the procedural crystal renderer for
  that particle.
- Context loss follows the existing background controller lifecycle. This work
  does not create a second recovery system.

## Implementation scope

Shared backgrounds package:

- `packages/backgrounds/src/backgrounds/winter/domain/models/winter-models.ts`
- a winter-owned pure optical-classification module and focused test;
- `packages/backgrounds/src/backgrounds/winter/services/SnowVolumeRenderer.ts`
- `packages/backgrounds/src/backgrounds/winter/services/SnowVolumeRenderer.test.ts`
- `packages/backgrounds/src/backgrounds/winter/services/SnowflakeSystem.ts`
- `packages/backgrounds/src/backgrounds/winter/services/SnowflakeSystem.test.ts`
- `packages/backgrounds/src/backgrounds/winter/services/WinterBackgroundSystem.ts`
- winter constants only where a value is genuinely shared by creation and
  rendering.

TKA application:

- `static/images/backgrounds/winter/snow-optics.webp`
- `static/test-winter-wind.html`
- the installed `@austencloud/backgrounds` version and lockfile after visual
  approval and package publication.

No BackgroundHost change is expected. It already forwards pointer type through
the public package API.

## Tests for silent failures

Focused deterministic tests must prove:

- optical-class ratios remain within their quality-tier ranges;
- foreground count caps hold for wide and portrait viewports;
- foreground birth weighting favors the outer frame without empty lanes;
- visual variant and focus values remain stable across updates;
- drawing consumes no random values;
- resize keeps positions, scales, and atlas indices finite and valid;
- gust stretch stays within its aspect-ratio cap;
- touch disables parallax and light without removing normal snow depth;
- reduced motion removes foreground optics and stops gust response;
- low quality never requests the atlas;
- an atlas failure preserves procedural snow and reports the correct metric;
- pointer-light falloff differs correctly by optical class;
- quality changes converge to the correct band counts without one-frame spikes.

Do not add pixel-golden unit tests for the final image. A visibly broken image
is not silent. Visual composition belongs to browser review.

## Visual approval gates

The first visual gate uses the standalone winter preview and pauses before
package publication. Austen reviews the result before integration.

Capture and inspect:

1. Calm snow at 1920 by 1080.
2. Active gust at 1920 by 1080.
3. Pointer light over mixed snow bands.
4. A foreground flake partly clipped by an edge.
5. Reduced motion at 1920 by 1080.
6. Final composed frames at 2560 by 1440, 3840 by 2160, 1440 by 900,
   820 by 1180, 960 by 412, and 375 by 667.

The visual pass fails if:

- foreground snow resembles bubbles or petals;
- the center is repeatedly covered by large flakes;
- the atlas repeats are easy to identify;
- a gust reads as rain, confetti, or a horizontal wipe;
- the cursor produces a visible sky halo;
- snow layers expose a rectangular density mask;
- the fixed sky moves;
- any viewport feels substantially emptier than the current winter scene;
- the effect competes with application controls or notation.

After visual approval, verify the installed package in the real
`BackgroundHost`, check the browser console, run the package tests and build,
run the TKA project check, and repeat the performance sample against the
published artifact.

## Research basis

- Canvas performance guidance recommends pre-rendering repeated artwork into a
  tightly sized offscreen surface and separating work by visual layer when it
  reduces repeated drawing:
  <https://web.dev/articles/canvas-performance>.
- `OffscreenCanvas` can move canvas work away from DOM synchronization and is
  broadly available, but this design needs it only as an optional cache surface:
  <https://web.dev/articles/offscreen-canvas>.
- `CanvasRenderingContext2D.filter` remains outside Baseline support, so it is
  not part of the runtime contract:
  <https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter>.

## Concurrent-work gate

The shared-package checkout currently has uncommitted changes that replace
`WinterParallaxTracker` with the shared `DepthParallaxTracker`. Those changes
also touch `SnowflakeSystem.ts` and `WinterBackgroundSystem.ts`, which are
required by this design.

Implementation must not begin until that overlap is committed, handed off, or
otherwise coordinated in the primary checkout. Do not create a branch or
worktree to bypass the conflict. The spec itself is safe to commit in the TKA
repository because it does not overlap those source files.

## Release gate

Do not publish from a dirty shared-package checkout. After Austen approves the
visual gate:

1. isolate only the committed winter source through a clean archive;
2. run package tests, TypeScript build, publint, and focused package-entry
   checks;
3. inspect the npm tarball manifest;
4. publish the next available package version;
5. update TKA's dependency and lockfile;
6. verify the installed artifact through Chrome DevTools;
7. commit only the explicit TKA integration paths.
