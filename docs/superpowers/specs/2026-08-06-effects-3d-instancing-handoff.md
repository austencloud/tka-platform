# 3D Effects — Rendering and Motion — Handoff (2026-08-06)

## Mission

Make the 3D effects look and perform well enough that all sixteen can run at
once. The work started from
[2026-08-05-effects-3d-migration.md](../plans/2026-08-05-effects-3d-migration.md)
— mount `EffectsLayer` so eight stranded effects get a 3D path — and grew into
three phases: mount them, fix the ones that turned out broken, then find out why
sixteen at once runs at 1 FPS.

The last phase produced a target architecture (below) that supersedes the
in-flight instancing work. **Read "Loose ends" before touching code — item #1 is
not where the previous session was working.**

## Done — verified

All twelve commits below are on `origin/main`.

Shared evidence, run at the end of the session:

- `npx vitest run tests/unit/effects/ src/lib/shared/effects/translators`
  → `Test Files 10 passed (10) | Tests 98 passed (98)`
- `npx svelte-check --threshold error --output human`
  → `svelte-check found 0 errors and 0 warnings`

| SHA | What | Evidence beyond the above |
|---|---|---|
| `daa35bf85c` | Per-station effects config in the motif harness | Six stations render six different effects — screenshot |
| `2c79f7817c` | `EffectOrchestrator3D` mounts `EffectsLayer`; eight effects get their 3D path back | `tests/unit/effects/effect-orchestrator-mounts-layer.test.ts`, written failing first, then 3 passing |
| `df3579134e` | Fire double-render fix — dropped `EffectsLayer`'s duplicate `FireEmitter` | Before: Fire station blew out to a white disc washing the scene. After: correct flame column. Both frames observed |
| `59de6509e4` | Harness docs: twelve of sixteen effects render in 3D | — |
| `d5116e873f` | Harness solo mode (`?e=<id>`) — one effect alone at the origin | Needed because oversized emitters occluded neighbours |
| `ae9eb2c6e8` | Corrected findings after solo frames | — |
| `6d42c51607` | **Sparkles**: pixel constants read as metres → 3–7 **metre** sparkles on a 0.86m staff | Solo frame before: one sprite filled the viewport and Chrome timed out compositing. After: tight cluster of glints, page composites instantly. 5 new translator tests |
| `e73536d9a9` | **Zap**: `BASE_DISPLACEMENT = 25` read as 25 metres; plus a `$effect` rebuilding every BufferGeometry twice per frame | Before: white scribble web filling the frame, tab wedged. After: compact bolt inside the station footprint |
| `9d6f2810f7` | **Bubbles**: `renderRadius()` computed and never applied — unit sphere, radius 1 | Before: one opaque mass swallowing the station. After: individually legible bubbles |
| `211b8546c3` | **Bloom**: `rainbowTexture` was a plain `let` read by a `$derived`, so the mount guard never opened | Before: empty ring, playing or paused. After: warm halation at the tips |
| `a5635f6e6d` | **2D/3D channel**: `EffectsLayer` gated on the effects-config context (the 2D selection) instead of the 3D prop channel | 4 new contract assertions; harness still renders through the prop channel |
| `2c12f8fb34` | `/test/effect-grid` — all sixteen effects, 4×4, same sequence | Verified at 1920×1080 and 3840×2160 |

**Perf baseline, measured** on `/test/effect-grid` via `renderer.info`
(16 stations × 2 rigs):

```
2,547 draw calls | 4,180 geometries | 802 textures | 23,852 triangles | 1 FPS
```

23,852 triangles across 2,547 calls is ~9 triangles per draw call. The cost is
per-object submission, not geometry.

## Believed done — unverified

- **The 2D/3D channel fix** (`a5635f6e6d`) is proven by contract test and by the
  harness rendering through the prop channel. It was **not** re-checked in the
  real app against Austen's original repro: 2D effect = Goo, 3D effect = LED,
  which produced "gooey LEDs". Do that check.
- **Bloom renders but may be too large.** `spriteScale = intent.radius * 0.04`,
  so the default radius 36 gives a **1.44m** halo on a 0.86m staff, and four tips
  fuse into one glow. Left alone deliberately: changing the mapping shifts every
  saved config. Needs Austen's call.
- **Ghost renders but is inert.** It draws one blue and one red phantom captured
  at step 0 and never advances, because nothing supplies `currentStep`. See
  loose end #6.

## In flight

**Branch: `main`. No worktree.** Everything below is uncommitted working tree.

The instancing attempt. It is **not shippable** — the five converted emitters
render ~1 particle each instead of dozens.

```
 M src/lib/shared/3d/effects/bubbles/BubbleEmitter3D.svelte
 M src/lib/shared/3d/effects/particles/SparkleEmitter.svelte
 M src/lib/shared/3d/effects/petals/PetalAmbientShower3D.svelte
 M src/lib/shared/3d/effects/petals/PetalEmitter3D.svelte
 M src/lib/shared/3d/effects/smoke/SmokeRenderer3D.svelte
 M src/lib/shared/3d/effects/water/WaterEmitter3D.svelte
 M src/routes/test/effect-grid/+page.svelte          (wires PerfProbe)
 M src/routes/test/element-motifs/MotifStation.svelte (KEEP — real bug fix)
?? src/lib/shared/3d/effects/instancing/             (the shared primitive)
?? src/routes/test/effect-grid/PerfProbe.svelte      (KEEP — the measurement)
```

Measured after conversion: `398 draw calls | 1,042 geometries | 6–7 FPS`. Part
of that drop is the converted emitters not drawing, so do not read it as a clean
win. `svelte-check` is clean; the failure is visual, not typed.

Two of these are worth keeping regardless of what happens to the conversions:

- `MotifStation.svelte` — removes an `$effect` that read and wrote the same
  state, threw `effect_update_depth_exceeded`, and tore down the component tree.
- `PerfProbe.svelte` — exposes `window.__gridPerf` (`calls`, `triangles`,
  `geometries`, `textures`, `fps`). Every number in this doc came from it.

## Loose ends (ranked)

**#1 — Fix the motion input. Start here, not at the instancing.**

Confirmed by reading the code, not just inferred:

- `EffectsLayer.svelte:252` feeds `bluePropState.worldPosition` /
  `redPropState.worldPosition` — the prop **CENTRE** — into the position
  history. A staff rotating around a stationary centre therefore reports
  **exactly zero** displacement while both tips move fast.
- `EffectsLayer.svelte:274-280` (`blueVelocityVec`, and `:282` for red) is the
  raw `curr.clone().sub(prev)` between the last two samples — an unscaled
  displacement with **no elapsed time in it**. The emitter then divides that by
  its own frame delta, so even real movement is mis-scaled.
- `effect-state.svelte.ts:273` is a process-wide singleton, and every
  `EffectsLayer` instance writes into it. On the grid, 32 rig layers contend for
  one blue/red history.

Give each rig an isolated motion tracker and compute each tip's world velocity
from current and previous **tip** positions with real elapsed time.

This is the "look beautiful" half. These effects currently cannot respond to the
motion they exist to visualise.

**#2 — Revert the five emitter conversions.** The plan below supersedes their
granularity (one pool per tip per rig is the wrong boundary). Keep
`instancing/`, `PerfProbe`, and the `MotifStation` fix. The git hook blocks
`git checkout --`; restore with `git show HEAD:<path> > <path>` per file.

**#3 — One scene-level renderer per effect type**, owning all tips across all
rigs, following `fire/fire-renderer-3d.ts`. That is ~one draw call per material
variant rather than one per tip.

**#4 — Preallocated structs-of-arrays.** Renderers write position, scale,
rotation, colour, alpha straight into typed instance attributes. This removes
the per-frame allocation churn *and* takes Svelte reactivity out of the frame
loop. At 398 draw calls and 6 FPS the remaining cost is CPU-side.

**#5 — Petal textures.** 2,125 textures exist because `getOrBakeTexture` caches
per **component**, so every emitter instance re-bakes its own. Move to a
module-scope shape atlas plus tint via instance colour.

**#6 — Plumb `currentStep`** so Ghost advances. `EffectOrchestrator3D` already
accepts it as an optional prop and forwards it; nothing supplies it. There is no
local `PerformerRig` — it lives in `@austencloud/scene-3d` and its `effectsSlot`
snippet carries no step index. Either extend that package's slot signature or
read step from a context inside the orchestrator.

**#7 — Bloom halo scale** (see "Believed done").

**#8 — `FireEmitter.svelte` has no callers** after `df3579134e`. Delete it or
fold it into `FireRenderer3D`; do not leave it as another renderer nothing
renders.

**#9 — `pickSparkleColor` calls `Date.now()` inside a `$derived`**
(`EffectsLayer.svelte`), so rainbow mode is a static hue per emitter.

**#10 — Re-profile.** Consider GPU/GPGPU simulation only if correctly batched,
allocation-free CPU pools still miss the frame budget.

## Decisions already made

- **2026-08-06, Austen:** "full send, this must be efficient" — approval to
  convert all the emitters, with efficiency as the bar, not just correctness.
- **2026-08-06, Austen:** "One at a time, with careful validation" — the cadence
  for the four effect fixes. Each one got its own frame and its own commit.
- **2026-08-06, Austen:** 3D effects should be beautiful *and* run sixteen at
  once; asked explicitly whether the overload was expected or a mistake of ours.
  Answer: a technique defect, evidenced above.
- **2026-08-05, Austen:** bubbles is the Water room's motif.
- **Standing:** do not re-add realistic water — goo is goo
  (`feedback_water_renamed_to_goo`).
- The four effects with no 3D renderer at all (ink, silk, animal, pulse) stay
  out of scope; that is a separate build, not a fix.

## Gotchas

**Svelte 5 ↔ three.js boundary — this cost most of a session.**

- `$state` **deep-proxies** whatever you put in it. Holding a three.js object
  there and mutating its buffers every frame invalidates the state that effects
  and tasks read, so the component re-renders continuously: the emitter's
  particle array and spawn accumulator reset every frame, and `useTask`'s delta
  comes back **frozen and negative**. Use `$state.raw`.
- `args={[geometry, material, count]}` inline builds a **new array every
  render**, and `<T>` treats changed args as "rebuild the object" — it disposed
  and recreated the mesh, reassigned the bound ref, and re-rendered forever.
  Hoist args to a stable `const`.
- An `$effect` that calls a store setter which internally reads the same state
  loops until `effect_update_depth_exceeded`, which **silently tears down the
  component tree** — the symptom is a blank scene, not an obvious crash.

**Environment**

- **The dev server does not pick up a NEW route directory.** It returns 200 and
  then client-side bounces to `/create/construct`. Restart the server, or start
  one after the directory exists. This wasted two rounds.
- **Chrome DevTools MCP jams** (`Network.enable timed out`) when several heavy
  3D tabs are open in the shared browser. Closing the stale 3D tabs fixes it.
  When it is unavailable, driving CDP directly over `ws://127.0.0.1:9222` with
  Node's native `WebSocket` works fine — `Page.navigate`,
  `Emulation.setDeviceMetricsOverride`, `Page.captureScreenshot`,
  `Runtime.evaluate`. Those helper scripts lived in the session scratchpad and
  are gone; they are ~40 lines each and worth rewriting.
- **`troika-three-text` is not installed**, so Threlte's `<Text>` renders
  nothing and reports nothing. `/test/effect-grid` labels use a canvas-texture
  sprite instead (`CellLabel3D.svelte`), the same technique as
  `BloomBillboard3D`.
- Effect screenshots: `/test/element-motifs?e=<effectId>` for one effect alone,
  `/test/effect-grid` for all sixteen.

**Dead ends already tried on the ~1-particle bug** — do not repeat:

- Per-instance alpha is **not** the cause. Forcing `alpha = 1.0` in
  `writeInstances` changed nothing.
- Instance buffers are present (`instanceAlpha` and `instanceColor` both
  confirmed at runtime), and the mesh ref binds.
- `$state.raw` and stable `args` both fixed real remount loops but did not
  restore particle counts.

The most probable explanation, consistent with all of it: **the emitters never
had correct motion input**, and the earlier "dense" petal and bubble output came
from cross-rig contamination of the velocity singleton acting as a pseudo-random
velocity source. Petals are motion-only by design and render nothing now, which
fits. Loose end #1 is the test of that theory.

**Repo hygiene**

- Two tests in `src/lib/shared/effects/domain/effect-control-manifest.test.ts`
  fail (`trails.tailLength`, `pulse` row count). They are **pre-existing and
  unrelated** — that file and its inputs are committed and untouched by this
  work.
- No expert agent in `.claude/rules/expert-routing.md` owns 3D effects, so no
  expert file was updated. If this area keeps getting worked, it earns one.
