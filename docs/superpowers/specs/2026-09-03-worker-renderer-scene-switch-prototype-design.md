# Worker Renderer Scene-Switch Prototype

**Date:** 2026-09-03  
**Status:** complete-frame Rainbow proof measured; production viewer migration in progress

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

- `initialize`: transferred canvas, request id, environment, size, DPR, camera,
  and immutable performer snapshots
- `resize`: CSS size and DPR
- `camera`: position, target, and field of view
- `performers`: latest avatar, body, and prop snapshots; newer snapshots
  coalesce while an avatar is loading
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
  the active slot removes the dead slot and exposes the error while leaving DOM
  controls usable. It does not auto-restart: an automatic retry loop on a
  device that cannot sustain the context would repeatedly allocate and fail.
- Rapid selection cancels and terminates the stale staging worker. Latest
  request wins.

## Prototype world scope

### Rainbow

Rainbow now has one canonical, renderer-neutral Three.js world factory in
`environments/worlds/rainbow/`. It owns the production sky, aurora, caustic
ground, prism platform, light shafts, orbiting lights, fog, and all four
particle fields. `RainbowScene.svelte` is a thin Threlte lifecycle adapter and
the worker world is a thin worker lifecycle adapter around that same owner.
There is no reduced worker-only Rainbow implementation.

### Ocean

The proof loads the real `/models/ocean/ocean-environment.glb` and
`/models/ocean/ocean_flora_scene.glb`, applies the canonical Ocean coordinate
frame, and renders a representative underwater grade. This exercises the
actual network, parse, upload, and shader path. It deliberately does not claim
parity for fish GPGPU, jellyfish interaction/audio, postprocessing, or every
authored material patch. Those must be extracted into worker-safe owners before
Ocean is enabled in the production viewer.

### Complete-frame performer

The proof now stages the real X-Bot through the package's renderer-neutral
avatar, skeleton, IK, and finger services. The application thread continues to
own choreography and sends compact performer snapshots; the worker owns the
avatar graph, body solve, and canonical rendered staff objects. The Svelte
`Staff3D` adapter and worker both call the same `createStaffObject` owner through
`@austencloud/scene-3d/worker`.

The worker and production viewer also consume one shared base-lighting profile.
This proves one exact staff-family performer inside the same depth, fog,
lighting, and WebGL context as Rainbow. It does not yet cover every prop family,
locomotion and turn clips, contact locking, effects, interaction picking,
badges, grids, or Ocean-specific postprocessing.

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
- Focused tests cover protocol, handoff, slot lifecycle, context bounds, and the
  canonical Rainbow world. A standalone worker-entry bundle plus the full
  production build verify worker-only imports and syntax that Svelte check does
  not necessarily traverse.

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

1. ~~Extract production Rainbow construction into worker-safe Three
   factories.~~ Complete: both renderers now call one exact world owner.
2. Extract Ocean in bounded layers: static seabed/reef, atmosphere/water,
   fauna compute/render, interaction/audio bridge, then postprocessing. Each
   layer gets a visual and memory parity gate.
3. Extend the proven complete-frame performer boundary from exact avatar plus
   staff-family props to locomotion, turns, contact locking, every prop family,
   effects, picking, badges, and grids. Keep choreography ownership on the
   application thread.
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
- Claiming Ocean production parity or production-viewer migration from this
  architectural proof.
- Rewriting the Choreo Card, sequence, or application UI systems.

## Measured proof, 2026-09-04

The exact shared Rainbow world retained the worker handoff's responsiveness in
four alternating steady-state switches:

| Incoming world | Click to swap | Worker preparation | Main-thread max gap | Outgoing-frame max gap |
| -------------- | ------------: | -----------------: | ------------------: | ---------------------: |
| Ocean          |        745 ms |             572 ms |             17.8 ms |                16.8 ms |
| Rainbow        |        564 ms |             361 ms |             17.5 ms |                66.7 ms |
| Ocean          |        797 ms |             609 ms |             17.1 ms |                16.8 ms |
| Rainbow        |        580 ms |             393 ms |             20.3 ms |                66.7 ms |

Every steady-state switch passed the input, outgoing-frame, and context-count
gates. At swap there were two contexts; 500 ms later there was one.

The first cold Rainbow load on the Vite development server did **not** pass the
input gate: its largest application-thread gap was 102.9 ms. The exact cause is
not yet isolated, and this proof therefore does not claim that cold startup is
flawless. It does prove that environment construction, shader compilation, and
GPU upload can occur without freezing the application or the outgoing 3D world
once the worker module is resident.

The production sequence viewer still uses the main-thread Threlte renderer.
Moving the environment alone into a second canvas is not an exact solution:
separate contexts cannot share depth, fog, lighting, occlusion, or postprocess
state. Production migration requires the worker to own the complete 3D frame,
including performer, props, effects, and camera, while Choreo timing and UI
remain on the application thread.

### Complete-frame Rainbow checkpoint

The benchmark now includes the real X-Bot, live two-staff Choreo snapshots, the
shared production lighting profile, and the exact Rainbow world. Sixteen
alternating switches produced these medians:

| Incoming world | Median click to swap | Main-thread gap | Outgoing-frame gap |
| -------------- | -------------------: | --------------: | -----------------: |
| Ocean          |             2,112 ms | 18.7-161.6 ms   |       16.9-50.1 ms |
| Rainbow        |             1,735 ms | 18.2-25.4 ms    |       16.8-17.0 ms |

The formal gates are at most 50 ms of application-thread delay and at most
100 ms between outgoing worker frames. Three application-thread outliers were
87.0, 91.0, and 161.6 ms. Fifteen of sixteen outgoing intervals remained near
a 60 fps cadence; one reached 50.1 ms but still passed the formal continuity
gate. Every swap observed two live contexts and returned to one after cleanup.

Rainbow's transmissive orb and platform materials were also removed after
measurement showed they triggered a hidden whole-scene transmission pass. GPU
program count fell from 17 after first render to 12 throughout preparation;
complete-frame preflight fell from 205-236 ms to 3-7 ms, and the first rendered
frame fell to 1-4 ms in the measured runs.

This checkpoint does **not** meet the word "flawless": 3 of 16 switches missed
the input gate, Ocean remains representative rather than exact, and the
production viewer is not routed through this backend. The proof earns the
complete-frame worker architecture; it does not earn a production parity claim.
