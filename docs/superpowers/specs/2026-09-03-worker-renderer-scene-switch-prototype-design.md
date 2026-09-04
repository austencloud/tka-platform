# Worker Renderer Scene-Switch Prototype

**Date:** 2026-09-03  
**Status:** implementation approved; Ocean and Rainbow proof in progress

## Outcome

A scene choice must never make the application thread stop answering input.
The outgoing environment remains visibly alive while the replacement loads,
parses, uploads, links, and renders in a dedicated worker. The DOM changes the
visible canvas only after the incoming worker proves it produced a complete
frame.

This prototype proves the renderer boundary with Ocean and Rainbow before the
other environments move. It does not replace the production viewer until its
visual and interaction parity checks pass.

## Why the current renderer cannot reach the target

The production viewer keeps Svelte, Threlte, scene construction, and WebGL on
the application thread. Measurements in `docs/architecture/scene-boot-cost.md`
found individual environment-mount and driver calls that block that thread for
1.3 to 5.3 seconds. Yielding around a synchronous WebGL call cannot interrupt
the call itself.

Ocean and Rainbow exercise different failure modes:

- Ocean loads and constructs the largest environment and owns GPGPU, render
  targets, authored reef geometry, and custom material patches.
- Rainbow is asset-light but constructs many procedural meshes and custom
  shader programs.

If the boundary cannot protect the application thread for both, migrating the
remaining environments would not be justified.

## Research constraints

- `HTMLCanvasElement.transferControlToOffscreen()` transfers a canvas exactly
  once and throws after a context has already been created. Canvas ownership
  must therefore be decided before renderer creation.
- `OffscreenCanvas` is transferable and WebGL plus
  `requestAnimationFrame()` are available in a dedicated worker.
- A worker has no DOM. Size, camera, input, visibility, quality, environment,
  and performer state must cross an explicit message boundary.
- WebGL resources cannot move between contexts. An environment prepared in a
  second context must remain attached to that context; it cannot be inserted
  into the existing Threlte renderer.
- Three.js accepts `OffscreenCanvas` as `WebGLRenderer.domElement` and its
  official worker guide uses the same transfer model.

Primary references:

- https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen
- https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope/requestAnimationFrame
- https://threejs.org/manual/en/offscreencanvas.html
- https://threejs.org/docs/pages/WebGLRenderer.html

## Ownership decision

Search terms: `OffscreenCanvas`, `transferControlToOffscreen`, `Worker`,
`postMessage`, `Environment3D`, `scene transition`, `renderer`, `Canvas`.

- `Environment3D.svelte` remains the canonical environment-selection and
  transition owner for the current renderer.
- `shared/3d/worker-renderer/` is a new renderer-backend boundary. No existing
  owner can accept an `OffscreenCanvas` or construct a Three scene without
  Svelte/Threlte.
- The prototype composes the real scene-selection vocabulary and real assets.
  It is isolated behind a test harness and does not add a second production
  scene picker.
- Worker-safe world factories are the intended eventual owners of environment
  construction. A production migration converts the current Svelte scene into
  a thin adapter around the same factory before enabling that environment in
  the viewer. Two permanent implementations of one environment are forbidden.
- Existing composition/export workers are reused as protocol and lifecycle
  examples, but their 2D render pipelines have a different contract and are
  not extended into the interactive 3D renderer.

## Architecture

### Two canvas slots

The host owns two absolutely stacked `HTMLCanvasElement` slots. Each slot may
own one dedicated worker and one transferred `OffscreenCanvas`:

```text
Svelte/UI/main thread
  scene choice, choreography, camera/input, telemetry
      |
      +-- active slot worker -> current WebGL context -> visible canvas
      |
      +-- staging slot worker -> incoming WebGL context -> opacity 0 canvas
```

On a scene request:

1. Start the staging worker and transfer its untouched canvas.
2. Send size, DPR, camera, quality, and requested environment.
3. Keep the active worker rendering. The UI remains interactive.
4. The staging worker loads, constructs, compiles, and renders.
5. It reports `first-frame` only after a successful `renderer.render()`.
6. On the next application-frame boundary, make staging visible and active
   invisible as one DOM state update.
7. Terminate and remove the previous worker after the handoff frame.

At steady state there is one worker and one WebGL context. During preparation
there are at most two. The prototype does not retain a multi-world GPU cache;
the measured Ocean memory cost makes an unbounded LRU unsafe.

### Why two workers instead of one

One worker protects DOM input, but an indivisible environment-construction or
driver call would still freeze the only visible 3D frame. A staging context is
the only available browser primitive that can perform that call while the
outgoing context continues presenting frames. The temporary memory cost is the
explicit price of a no-blank, no-frozen-world handoff.

### Command protocol

Main to worker:

- `initialize`: transferred canvas, request id, environment, size, DPR, camera
- `resize`: CSS size and DPR
- `camera`: position, target, and field of view
- `visibility`: whether this slot should continue animating
- `dispose`: deterministic teardown

Worker to main:

- `booting`: worker accepted the request
- `progress`: phase and normalized fraction
- `first-frame`: request id, preparation timings, renderer memory
- `frame`: throttled frame heartbeat for continuity measurement
- `context-lost` / `error` / `disposed`

Every message carries a monotonically increasing request id. A late result may
never replace a newer choice.

### Failure behavior

- If worker or OffscreenCanvas support is missing, the existing main-thread
  renderer remains available. The prototype reports unsupported rather than
  claiming success.
- A staging error leaves the active canvas untouched and terminates only the
  failed slot.
- A context loss before handoff behaves like a staging error. A context loss in
  the active slot requests a replacement while leaving DOM controls usable.
- Rapid selection cancels and terminates the stale staging worker. Latest
  request wins.

## Prototype world scope

### Rainbow

The proof uses procedural Three geometry and custom shader programs to
exercise shader creation without network assets. It is a benchmark world, not
yet the visual-parity implementation. Production migration requires extracting
`RainbowScene.svelte`, `PrismPlatform.svelte`, `SkyGradient.svelte`, and
`FallingParticles.svelte` into shared worker-safe factories, then making both
the Svelte adapter and worker call those owners.

### Ocean

The proof loads the real `/models/ocean/ocean-environment.glb` and
`/models/ocean/ocean_flora_scene.glb`, applies the canonical Ocean coordinate
frame, and renders a representative underwater grade. This exercises the
actual network, parse, upload, and shader path. It deliberately does not claim
parity for fish GPGPU, jellyfish interaction/audio, postprocessing, or every
authored material patch. Those must be extracted into worker-safe owners before
Ocean is enabled in the production viewer.

## Choreo Card contract

The card URL, sequence schema, Firebase reads, Svelte UI, viewer controls, and
choreography state remain on the application thread. This prototype changes no
card or sequence data. A later production renderer receives a compact immutable
sequence snapshot plus time/selection commands; it does not become the owner of
what a Choreo Card means.

## Measured acceptance gates

The prototype records its own timing and exposes it on
`window.__workerSceneSwitchBenchmark`.

For a switch after the first world is visible:

- main-thread input/timer delay: no observed gap above 50 ms attributable to
  environment preparation;
- outgoing worker frame continuity: no heartbeat interval above 100 ms before
  handoff while the page is visible;
- handoff: incoming `first-frame` precedes the visible-slot change;
- blank-frame protection: the active slot is never absent;
- supersession: rapid choices reveal only the last request;
- memory bound: no more than two live workers/contexts during preparation and
  one within two animation frames after handoff;
- errors: no uncaught exception, WebGL error, or context-loss loop.

The first benchmark records actual results even when a gate fails. Failing a
gate means the architecture or implementation changes before broader scene
migration; it does not get softened into a pass.

## Verification

### Automated

- Protocol guards reject malformed and stale messages.
- Slot state transitions preserve one active slot, enforce latest-request-wins,
  and never exceed two live slots.
- A staging failure cannot remove the active slot.
- Worker world disposal releases scene resources and renderer context.
- Focused tests transform the worker entry so a worker-only syntax error cannot
  hide behind a green Svelte check.

### Runtime

- Build the production bundle and serve it from the task worktree.
- Open the worker harness in a fresh browser context.
- Switch Rainbow -> Ocean and Ocean -> Rainbow, including rapid repeated
  choices.
- Record preparation time, application-thread timer gaps, active-worker frame
  gaps, handoff ordering, worker count, renderer memory, and console/WebGL
  errors.
- Capture both worlds to distinguish a fast blank canvas from a real rendered
  frame.

## Migration after the proof

1. Extract production Rainbow construction into worker-safe Three factories;
   prove pixel/feature parity, then enable Rainbow in the shared backend.
2. Extract Ocean in bounded layers: static seabed/reef, atmosphere/water,
   fauna compute/render, interaction/audio bridge, then postprocessing. Each
   layer gets a visual and memory parity gate.
3. Move performer/prop construction or establish the protected foreground
   renderer only after measuring compositing, lighting, and interaction parity.
4. Migrate the remaining eight environments through the same factory contract,
   ranked by measured stall cost.
5. Enable the backend by capability and quality tier, retain the current
   renderer fallback until browser/device acceptance is complete, then remove
   the old environment implementations as each factory becomes canonical.

## Non-goals

- WebGPU migration. It does not isolate the application thread and was already
  rejected as a boot-time fix by measurement.
- Texture cooking as a load-time fix. It remains a separate VRAM decision.
- Keeping every environment resident.
- Claiming Ocean or Rainbow production parity from this architectural proof.
- Rewriting the Choreo Card, sequence, or application UI systems.
