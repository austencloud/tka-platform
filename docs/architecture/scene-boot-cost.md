# Scene Boot Cost — Measured, and the Dead Ends

**Status:** settled 2026-09-02; two defects found and fixed the same day.
Re-open only with new measurements from the boot profiler, never from
reasoning about what "should" be slow.

This document exists so no future session re-derives it. Three separate
sessions independently proposed texture cooking as the fix for 3D load time.
It is not the fix, and the numbers below are why.

## Why this was written

Austen demos the app to people at parks. Load time is the product problem.
Two plausible-sounding fixes were proposed, costed, and then killed by
measurement:

1. Cook all scene textures to KTX2/Basis.
2. Migrate the renderer to WebGPU.

Both were killed. Neither should be proposed again without new evidence.

## The instrument

`src/lib/shared/3d/scene-boot/boot-profiler.ts` — opt-in, ships on `main`,
zero cost when off.

Enable any one of:

- `?bootprofile=1` on the URL
- `localStorage["tka-boot-profile"] = "1"`
- `window.__sceneBootProfileEnabled = true`

It attributes the boot window by patching `createImageBitmap` and the WebGL
prototypes, and unions the resulting intervals rather than summing them —
summing 210 concurrent texture decodes describes no elapsed time. Categories:

| Category | What it patches |
| --- | --- |
| `fetch` | `PerformanceObserver` resource entries |
| `decode` | `createImageBitmap` |
| `textureUpload` | `texImage2D`, `texSubImage2D`, `texImage3D`, `texSubImage3D`, `texStorage2D`, `compressedTexImage2D`, `compressedTexSubImage2D`, `generateMipmap` |
| `bufferUpload` | `bufferData`, `bufferSubData` |
| `shaderSync` | `compileShader`, `linkProgram`, `getProgramParameter`, `getShaderParameter`, `getProgramInfoLog` |
| `gpuSync` | `finish`, `readPixels` |

It also reports `blockedMs` (union of long tasks), `unexplainedBlockedMs`
(blocked minus instrumented GPU calls — i.e. GLB parse and scene-graph work),
and `idleMs`. The report publishes to `window.__sceneBootProfile` and prints
to the console at reveal.

Interval math lives in `boot-interval-math.ts` and is unit-tested.
`tests/unit/boot-profiler.test.ts` exists because `npm run check` does **not**
typecheck a plain `.ts` file reachable only through a Svelte import graph — a
syntax error in the profiler passed a green check and took down every 3D scene
on `main`. That test imports the module so vitest transforms it. Do not delete
it.

## The numbers

Ocean scene, dev server, `/test/ocean-scene?bootprofile=1`.

| Run | assets | compile | settle | total |
| --- | --- | --- | --- | --- |
| Cold | 5,530 ms | 5,242 ms | 3,250 ms | 14,024 ms |
| Warm | 2,709 ms | 1,823 ms | 3,167 ms | 7,700 ms |

Warm-run attribution across the whole 7,700 ms window:

| Slice | Wall | Calls |
| --- | --- | --- |
| `fetch` | 6,603 ms | 563 |
| `shaderSync` | **980 ms** | 107 |
| unexplained main-thread block (GLB parse, scene graph) | **583 ms** | — |
| `textureUpload` | 132 ms | 23 |
| `decode` | 47 ms | 15 |
| `bufferUpload` | 18 ms | 102 |
| idle | 603 ms | — |

**Only `fetch` is contaminated.** Those 563 requests are the dev server's
unbundled modules, not the production bundle. Every GPU and JS category above
is a real reading.

Reference point, Tauri desktop build, taken before the profiler existed:
assets 5,424 ms / compile 2,533 ms / settle **114 ms**. Re-measuring the
desktop numbers with the profiler requires a Tauri rebuild and has not been
done.

## Settled: do not re-propose these

### Texture cooking (KTX2 / Basis) does not help load time

Decode + upload is **179 ms of 7,700 ms** — 2.3%. Three independent methods
now agree. KTX2 also makes the download roughly 5x larger. Its only real win
is VRAM headroom, which is not the problem being solved.

If a future task genuinely needs VRAM relief on low-end mobile, that is a
different justification and must say so explicitly.

### WebGPU does not help load time

The dominant cost is the GPU driver building shader programs. WebGPU v1 has
no persisted pipeline cache, so the equivalent pipeline creation happens on
every launch there too. Same wait, plus a renderer migration.

### `renderer.debug.checkShaderErrors = false` saves nothing

This one nearly shipped. three.js `onFirstUse`
(`three.module.js:6895`) calls `getProgramInfoLog`, which blocks until the
driver finishes linking. It profiles at 1,240 ms across 39 programs, which
reads exactly like a one-line 1.2-second win.

A/B, stubbing the info-log calls to return instantly:

| Call | Baseline | Info-log stubbed |
| --- | --- | --- |
| `getProgramInfoLog` | 1,240 ms / 39 | ~0 |
| `getProgramParameter` | 18 ms / 256 | **1,135 ms / 280** |

The wait relocated. It is driver link time, and it does not disappear by
declining to ask for it. Any future "just skip the shader error check" patch
is this same non-fix; measure before believing it.

## Fixed 2026-09-02 — do not "fix" these again

Both leads below were investigated and closed. The numbers are same-machine
before/after on `/test/ocean-scene`, warm, page foregrounded.

| Phase | Before | After |
| --- | --- | --- |
| assets | 2,842 ms | 2,185 ms |
| compile | 2,942 ms | **673 ms** |
| settle | 1,590 ms, `capped` | **191 ms, `passed`** |

### The frame gate could not pass at 30fps

`DEFAULT_FRAME_GATE.frameBudgetMs` was 20 ms — under half a 30 fps frame — and
the gate wanted five consecutive frames inside it. A heavy scene settles at a
steady 30 fps, so the streak was unreachable and the boot paid the full 1,500 ms
cap as a flat delay with zero blocked time and zero GPU calls. Measured cadence
during settle: p50 33.3 ms, p90 33.4 ms, 34 of 53 frames over the old budget.

The budget is now 40 ms. At the identical 33.3 ms cadence the gate passes in
191 ms. It still resets on the 130 ms hitches it exists to hide.

A second defect: the cap was only tested when a frame arrived, and
`requestAnimationFrame` does not fire in a hidden document, so a scene booted in
a background tab waited on a cap that could never come. The settle loop in
`SceneShaderWarmup.svelte` now races the frame loop against wall-clock time.

Caveat worth keeping: on a machine already rendering at 60 fps the old gate
passed fine, so this fix buys nothing there. It is the 30 fps case — a heavy
scene, a phone, a loaded machine — that was paying 1.5 s.

### The shader warm-up awaited one program at a time

`warmupRenderer` ran `await renderer.compileAsync(...)` in a loop.
`compileAsync` (`three.module.js:16992`) does its traversal and program
creation synchronously and then returns a promise that polls
`KHR_parallel_shader_compile` on a **10 ms `setTimeout` chain**. Awaiting them
in turn therefore paid every driver link end to end *plus* a poll tick per
program, with the GPU idle in between.

The calls are now dispatched together and awaited as a group. Same-server A/B,
three runs each: compile phase 1,615 / 2,103 / 1,695 ms → 240 / 216 / 293 ms.
The synchronous GL work is unchanged (~200 ms); what disappeared was the
waiting. `tests/unit/scene-boot/renderer-warmup.test.ts` pins the concurrency,
because serialization is invisible at runtime — it just takes longer.

## Still open

The **assets** phase still does ~1,000 ms of shader linking across ~125 calls
before the warm-up runs at all — programs linking at first draw as each mesh
mounts. Moving that work earlier, or reducing the distinct program count
(material variants, `defines` permutations), is the next lever. Not attempted.

## Re-measuring

1. Open `https://localhost:5173/test/ocean-scene?bootprofile=1`. Any route
   that mounts `SceneShaderWarmup` works; routes that don't (e.g.
   `/test/forest-scene`) produce no spans and will read as all-nulls.
2. Read `window.__sceneBootProfile`, or the console report at reveal.
3. Say which run was cold and which was warm. They differ by ~2x.
4. State that `fetch` is dev-contaminated whenever quoting a dev-server run.

## Related

- `src/lib/shared/3d/scene-boot/` — the boot window's owners
- `.claude/rules/canonical-capabilities.md` — scene-boot routing row
- `.claude/rules/verification-protocol.md`, `no-assumption-without-evidence.md`
- `memory/reference_scene_boot_cost_measured.md`
