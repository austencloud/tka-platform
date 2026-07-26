---
status: backlog
value: 2
effort: M
remaining: "Body status: Approved (design), pending implementation plan"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Museum Keep-Alive Persistence — Design

Date: 2026-05-29
Status: Approved (design), pending implementation plan
Topic: Make the museum module mount with near-instant speed on return by keeping it alive (hidden) across module switches, with idle eviction to respect mobile WebGL limits.

## Problem

Switching away from the museum module and back triggers a full cold rebuild:
WebGL context recreation, geometry worker respawn, scene-graph rebuild, shader
recompilation, and village-sim teardown/restart. This costs multiple seconds and
shows the loading overlay every return — even though all that work was already
done on the first visit.

Root cause: `ModuleRenderer.svelte` renders all module content inside a
`{#key activeModule}` block (line 276). Switching modules destroys the entire
component subtree and recreates it on return. The component *class* is cached
(`moduleCache`), the grid is cached (sessionStorage), and avatar models are warm
in the HTTP cache — but the live GPU/worker/scene resources are destroyed every
leave. `MuseumModule.svelte` also calls `destroyMuseumVillage()` in its
`onMount` cleanup (line 91), killing the module-scope village singleton on every
exit.

Internally, MuseumModule *already* proves the fix works at a smaller scale: it
keeps its 3D scene alive across *mode* switches (museum/edit/showroom) via
`class:hidden-mode` CSS visibility (line 330) rather than unmounting. This design
lifts that same keep-alive pattern up one level — to the module switch boundary.

## Goals

- Returning to the museum after a quick hop (within the eviction window) is
  near-instant: no overlay, no rebuild, scene/worker/sim all warm.
- Memory and WebGL contexts are released when the user is genuinely away
  (idle eviction), so mobile context caps are respected.
- No background GPU/battery drain while the museum is mounted-but-hidden.
- Graceful degradation: after eviction (or browser-forced context loss) the
  next visit rebuilds via the existing warm-cache path, which is already
  hang-proof from the defensive fixes landed earlier.

## Non-Goals

- No change to the cold-load pipeline itself (grid builder, geometry streamer,
  loading overlay/progress bar) beyond gating the render loop.
- No keep-alive for other modules. The keep-alive set contains only `museum`
  for now. `archive` / `stage` may be added later behind the same mechanism.
- No global change to `{#key activeModule}` behavior for non-keep-alive modules.

## State-of-the-Art Validation

Confirmed against current sources (2026):

1. **Persistent canvas across SPA navigation is the documented pattern.** Create
   the scene once; keep the canvas outside the swapped content container; scene
   and resources stay warm (no re-init, no flicker, no repeated network).
   (Codrops "Seamless 3D Transitions" 2026; three.js forum.)
2. **Pause rendering when hidden is best practice.** Threlte `renderMode`
   (`on-demand` default / `always` / `manual`) + `useThrelte().advance()` /
   `invalidate()`. Museum already drives rendering manually via
   `MuseumPostProcessing` (sets `autoRender=false`). Caveat from R3F/Threlte:
   reactively flipping the Canvas `renderMode` prop does NOT take effect (only
   the first value counts) — so we gate the manual render *driver*, never the
   prop.
3. **WebGL context cap validates idle eviction over permanent residency.**
   Mobile allows only 2–8 live contexts per principal (Firefox mobile 2, Chrome
   Android 8); desktop 16. Permanent museum residency risks the browser
   force-evicting it (uncontrolled context loss) or starving other 3D scenes.
   Idle eviction frees the context proactively and predictably.

## Chosen Approach: Keep-Alive + Idle Eviction

Rejected alternatives:
- **Full permanent keep-alive** — instant, but holds a WebGL context + ~150-300MB
  GPU memory resident forever. Unsafe on mobile/Capacitor given the 2–8 context
  cap; the browser may evict it anyway.
- **CPU-persist, drop GPU** — keep worker + built geometry data, unmount Canvas.
  Lighter memory but return still re-uploads to GPU + recompiles shaders, so not
  instant. More plumbing for a worse return experience than keep-alive gives for
  the common quick-hop case.

Keep-alive + idle eviction takes the instant path for the common case (quick
hop) and the lightweight path when genuinely away.

## Architecture

Three coordinated pieces:

### 1. Keep-alive host in ModuleRenderer

`ModuleRenderer.svelte` gains a keep-alive set: `KEEP_ALIVE_MODULES = {"museum"}`.

- Keep-alive modules render in a **persistent container** that lives OUTSIDE the
  `{#key activeModule}` block. Once a keep-alive module is first activated, its
  component mounts and is never destroyed by the key.
- Visibility is controlled by `display` + a `visible` prop passed to the module
  (not just CSS — the module needs the signal to pause its render loop and sim).
- The existing `{#key activeModule}` block continues to render all non-keep-alive
  modules exactly as today.
- Only mount the persistent museum container *after* the user first visits museum
  (lazy) — do not pay the cost for users who never open it. The existing 3s idle
  `loadModule("museum")` warm-up (ModuleRenderer.svelte:66-75) caches the chunk;
  mounting the live scene stays gated on first activation.

State per keep-alive module:
- `mounted: boolean` — has it been activated at least once and not yet evicted.
- `visible: boolean` — is it the active module right now.
- `evictTimer` — pending idle-eviction timeout.

Transitions:
- Activate museum → `mounted = true`, `visible = true`, cancel any evictTimer.
- Switch away from museum (still mounted) → `visible = false`, start evictTimer
  (default 150s).
- Switch back before timer fires → `visible = true`, cancel evictTimer (instant).
- evictTimer fires while hidden → `mounted = false` → persistent container
  unmounts → MuseumModule `onDestroy` runs the real teardown.

### 2. Visibility threading + render/sim pause

`visible` flows: ModuleRenderer → MuseumModule → DimensionFlipProof → Museum3DScene.

- MuseumModule accepts a `visible` prop (default true for standalone/test use).
- When `visible` goes false:
  - Pause the manual render driver in `MuseumPostProcessing` / the Museum3DScene
    render `useTask` (gate on a `visible` flag; stop calling `advance()` / skip
    the render in the task). Do NOT flip the Canvas `renderMode` prop reactively.
  - Call `setMuseumVillageVisible(false)` (museum-village-manager.ts:116) to pause
    the sim tick loop.
- When `visible` returns true:
  - Resume the render driver + `setMuseumVillageVisible(true)`. Trigger one
    `invalidate()` so the first frame paints immediately.
  - Suppress the loading overlay on resume — the scene is already built, so
    `showOverlay` must NOT reset to true on a visibility resume. The overlay only
    runs on a genuine fresh mount (cold load).

`destroyMuseumVillage()` logic is unchanged. Its trigger simply moves from
"every leave" to "real unmount" — which now only happens on eviction or a true
page teardown. Because eviction unmounts the component, `onMount`'s cleanup
(MuseumModule.svelte:91) still fires `destroyMuseumVillage()` at exactly the
right moment. No code change to that line is required beyond the surrounding
mount-lifetime change.

### 3. Context-loss resilience

Wire `webglcontextlost` (preventDefault) and `webglcontextrestored` on the
museum canvas. Under mobile memory pressure the browser may evict our context
even while mounted. On loss: mark the scene not-ready and show a lightweight
rebuild affordance; on restore (or next activation): rebuild from the warm grid
cache via the existing streamer path. This converts a dead black canvas into a
recoverable state.

## Data Flow

```
activeModule changes (museum -> create)
  ModuleRenderer: museum.visible = false; start evictTimer(150s)
    MuseumModule(visible=false): pause render driver; setMuseumVillageVisible(false)
  [user in create]
  -- quick hop back within 150s --
    ModuleRenderer: cancel evictTimer; museum.visible = true
      MuseumModule(visible=true): resume render; setMuseumVillageVisible(true);
                                  invalidate() one frame; overlay stays hidden
    => instant, warm
  -- OR stay away > 150s --
    evictTimer fires: museum.mounted = false
      persistent container unmounts -> MuseumModule onDestroy ->
        destroyMuseumVillage() + worker terminate + GPU release
    => next visit: cold load via warm grid cache (hang-proof)
```

## Files Touched

- `src/lib/shared/modules/ModuleRenderer.svelte`
  - Add `KEEP_ALIVE_MODULES` set, persistent-container render path outside the
    `{#key}` block, `mounted`/`visible` state, evict timer logic, `visible` prop
    passdown.
- `src/lib/features/museum/MuseumModule.svelte`
  - Accept `visible` prop. Pause/resume render + sim on change. Ensure overlay
    does not re-arm on resume. Thread `visible` into DimensionFlipProof.
- `src/lib/features/museum/components/game/DimensionFlipProof.svelte`
  - Accept + forward `visible`. Add webglcontextlost/restored handlers on the
    canvas.
- `src/lib/features/museum/components/game/Museum3DScene.svelte`
  - Gate the render `useTask` / manual `advance()` on `visible`. `invalidate()`
    on resume.
- `src/lib/features/museum/components/game/MuseumPostProcessing.svelte`
  - Gate its manual render `useTask` on `visible` (it owns `autoRender=false`).
- `src/lib/features/museum/services/museum-village-manager.ts`
  - No new API needed (`setMuseumVillageVisible` exists). Confirm pause/resume
    is idempotent under rapid hops.

## Edge Cases

- **Rapid hop spam** (museum→create→museum within ms): evictTimer canceled each
  return; pause/resume must be idempotent and cheap. No teardown.
- **Eviction mid-resume race**: if evictTimer fires the same tick a re-activation
  arrives, re-activation wins — cancel timer before reading `mounted`.
- **Edit/showroom modes inside museum while hidden**: whole module hidden →
  paused regardless of internal mode. Internal mode state is preserved (it's
  component state, not destroyed).
- **HMR**: persistent container + module-scope village singleton already survive
  HMR; keep that behavior.
- **Room isolation (`?room=`)**: `{#key selectedRoom}` inside MuseumModule
  (line 331) still rebuilds the scene on room change — unchanged and correct.
- **First-ever visit**: cold load with overlay exactly as today. Keep-alive only
  affects subsequent returns.
- **Eviction timeout tuning**: 150s default; make it a single named constant so
  it's trivially adjustable. Consider shorter on mobile (detect via existing
  device signal if present) in a follow-up, not this pass.

## Testing / Verification

- Runtime (Chrome DevTools MCP, with permission): museum → create → museum within
  window; assert no overlay, no `runInitialLoad` re-entry, render resumes
  (one frame painted). Confirm console has no reconnect spam.
- Memory/context: after eviction window, confirm WebGL context count drops
  (query `WEBGL_lose_context` / context list or heap snapshot) and village sim
  destroyed.
- Hidden-state drain: while in create with museum mounted-hidden, confirm the
  museum render `useTask` is not executing (no frame advance) and sim is paused.
- Context-loss: simulate `WEBGL_lose_context().loseContext()`; confirm graceful
  restore path, not a permanent black canvas.
- Gate: one full `npm run check` before commit.

## Risks

- **Hidden context still counts toward the cap** while the evict timer is pending
  (≤150s). Acceptable: bounded, and eviction releases it. Other 3D modules
  opening during that window get the normal context budget once museum evicts.
- **Render-driver gating must be airtight** — a missed gate means background GPU
  burn. Verify with the hidden-state drain test above.
- **MuseumPostProcessing ownership of render** — gating must live where the
  actual `advance()`/render call is, not just in Museum3DScene. Confirm which
  component issues the final render before wiring the gate.

## Rollout

Single PR. Behind no flag (defensive, degrades to current behavior on eviction).
If a regression appears, the keep-alive set can be emptied to fully restore the
old destroy-on-leave behavior without removing the code.
