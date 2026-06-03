# Create Module Eager-Graph Deferral — Design

Date: 2026-05-31
Status: Partially shipped (verified). SequenceDrawerHost deferral = remaining planned work.

## Problem

"Loading Create" is slow. Runtime profiling (Chrome DevTools, dev `:5173`,
`?profile=1`) showed two loading screens back-to-back:

1. **App-boot splash** (`#app-loading` in `src/app.html`) — ~4.4s. Dominated by
   `di-container` (~2s) and `shell:main-app-chunk` (~2.4s, parallel). The
   MainApplication init phases (settings/workspace/theme/gamification) are
   negligible (18–200ms each) — instrumented and ruled out this session.
2. **"Loading Create"** (`ModuleRenderer.svelte`) — `module-chunk:create` =
   **~5.2–6.6s** in dev. This is the cost of fetching + transforming create's
   **881-file** eager import graph. This is the target.

Dev numbers are transform-dominated; prod bundles the graph, so the absolute
win lands on (a) the **prod create chunk size** and (b) **cold-dev** first paint.
Warm-dev reloads barely move (Vite caches transforms server-side).

Tooling: `scripts/trace-create-three.cjs` walks the static import graph from
`CreateModule.svelte` and sizes per-edge exclusive subtrees. Re-run after every
change to confirm the graph shrank.

## Profiling instrumentation (shipped this session)

Durable, dev-only, gated behind `?profile=1` / `localStorage.bootProfile='1'`:

- `src/lib/shared/analytics/boot-profiler.ts` — `summary()` now prepends the
  pre-JS phases (`net:ttfb`, `html:download→bundle-eval`) from Navigation Timing,
  so the console table covers the WHOLE loading screen, not just post-eval work.
- `src/lib/shared/application/components/MainApplication.svelte` — `bootProfiler`
  marks on the previously-invisible 84%→100% segment (`app:init-state`,
  `app:restore-workspace`, `app:load-settings+theme`, `app:gamification`).
- `src/routes/app/AppShellLoader.svelte` — `shell:main-app-chunk` mark around the
  MainApplication dynamic import.

Re-profile anytime: append `?profile=1`, reload, read the console boot table +
`[ModuleLoad] <module>: chunk fetch+eval Nms` debug line.

## Goal / success metric

Cut create's first-paint eager graph and prod chunk while preserving all create
functionality. Target: **881 → ~257 first-paint files (−71%)**.

| Lever | Eager files | Status |
|---|---|---|
| Baseline | 881 | — |
| Dynamic-import `get-create-module-initializer` (64) + `get-extension-flow-coordinator` (10) at their only call sites | 807 | ✅ verified |
| Defer 3 inactive build-mode panels + WorkspaceArea | 554 | ✅ verified |
| Defer `SequenceDrawerHost` | ~257 | 📋 this plan |

## Shipped + verified (uncommitted)

All verified rendering correctly via Chrome DevTools on `:5173`.

1. **`CreateModule.svelte`** — `get-create-module-initializer` (64-file subtree)
   and `get-extension-flow-coordinator` (10-file subtree) converted from static
   to dynamic `import()` at their only call sites (onMount / LOOP action handlers).
   Verified: create boots.
2. **`CreationToolPanelSlot.svelte`** — the 3 inactive build-mode panels deferred
   via `LazyMount`, one per `{:else if activeToolPanel === ...}` branch:
   `FuseTab` (235 files!), `GeneratePanel` (136), `AssembleToolPanel` (21).
   `ConstructTabContent` (45, default tab) stays eager. Verified: switching to
   generate/assemble triggers a 1.2–1.6s on-demand chunk load (= deferral working);
   construct renders at boot.
3. **`StandardWorkspaceLayout.svelte`** — `CreationWorkspaceArea` (85 files, gated
   on `hasWorkspaceContent`) deferred via `LazyMount`. Verified: mounts when a
   sequence is created.

Result: **881 → 554 files (−327, −37%)**, source 5971 → 4061 KB. Prod build
succeeds (exit 0). `module-chunk:create` warm-dev unchanged (~5.5s) because the
profiling session pre-transformed every deferred chunk — expected; the win is
prod + cold-dev.

## Remaining work: defer SequenceDrawerHost (the design)

`SequenceDrawerHost.svelte` is create's export/animation drawer host. It's the
single biggest remaining lever — **297 files exclusive** (grew from 55 after the
panel deferrals removed shared deps). It can't be naively `LazyMount`ed because it
owns two ALWAYS-ON responsibilities whose deps pull a **135-file navigator subtree**:

1. **`?sheet=animation` deep-link** — `ExportUrlManager.initialize()` (onRouteChange
   for `state.sheet === "animation"` + initial-URL `getCurrentAnimationPanelState()`)
   opens the export/animation panel.
2. **View-sequence redirect** — a `$effect` (host lines ~261–281) watching
   `panelState.isSequenceViewerOpen` that calls `openSequenceViewer(currentSequence,
   {returnPath, returnLabel})` (`sequence-viewer-navigator` + `sequence-handoff`).

Note: `AnimationSheetCoordinator.svelte` already implements an equivalent
`sheet === "animation"` listener, but it's a PARALLEL shared coordinator using
`AnimationShareDrawer` (not create's `SequenceDrawer`). Merging the two drawer
systems is a separate project — OUT OF SCOPE here.

### Approach: tiny always-mounted launcher + LazyMount the host (prefetch)

**New `SequenceDrawerLauncher.svelte`** (~40 lines, always mounted, near-zero
eager weight — only light deps already in the eager graph):
- **onMount:** initial `getCurrentAnimationPanelState()` check + `onRouteChange`
  for `state.sheet === "animation"` → `panelState.openExportPanel("animation")`.
  This flips the flag that LazyMount watches, mounting the host. Covers initial
  deep-links AND back/forward navigation.
- **`$effect` on `panelState.isSequenceViewerOpen`:** on flip → `closeSequenceViewer()`
  then **dynamic-import** `sequence-viewer-navigator` + `sequence-handoff` and call
  `openSequenceViewer(currentSequence, {returnPath, returnLabel})` with the
  ownership-stamping logic moved verbatim from the host. The 135-file navigator
  loads ONLY on this click, never at boot. `currentSequence` comes from
  `getCreateModuleContext()`; `authState` is already eager.

**`SequenceDrawerHost.svelte`:** remove the `isSequenceViewerOpen` redirect
`$effect` (moves to the launcher). Keep its `ExportUrlManager` (it needs
`playbackController` for state-sync while the panel is open — push/update/clear/
restore). Otherwise unchanged. Its urlManager re-firing on mount is harmless
(panel already open; `onStateRestore` does the speed/beat restore correctly).

**`CreateModule.svelte`:** replace `<SequenceDrawerHost />` with:
```svelte
<SequenceDrawerLauncher />
<LazyMount
  loader={() => import("./coordinators/SequenceDrawerHost.svelte")}
  active={panelState.isExportPanelOpen}
  prefetch
/>
```
`prefetch` (user choice = idle-prefetch) idle-warms the 297-file chunk after
create paints, so the first export-open is instant while first paint stays light.

### Net effect

297 files leave first paint (554 → ~257). Preserved: export, animation export,
`?sheet=animation` deep-links, back/forward URL behavior, view-sequence redirect.
First export-open instant via prefetch.

### Verification (interactive, Chrome DevTools `:5173`)

1. `scripts/trace-create-three.cjs` shows ~257 eager files.
2. Create boots on construct (no regression).
3. Open export panel → drawer mounts + renders; animation preview plays.
4. Click "view sequence" → redirects to the sequence viewer (navigator
   dynamic-imports on the click).
5. Load `/create?sheet=animation&...` deep link → export/animation panel opens +
   state restores.
6. Back/forward across the animation sheet → panel opens/closes correctly.
7. `npm run build` succeeds; SequenceDrawerHost + navigator emit as separate
   lazy chunks.

## Out of scope (flagged for later)

- **CLS 0.17** on create load — non-composited theme animations (scrollbar-color,
  border/box-shadow transitions) + the intentional `grid-template-rows 0fr→5fr`
  workspace-reveal animation + content-swap reflow. Needs a `no-layout-shift` pass;
  partly inherent to the smooth-reveal design. Not the user's stated pain.
- **Merging `SequenceDrawerHost` and `AnimationSheetCoordinator`** drawer systems.
- **Two module-persistence keys** (`tka-active-module-cache` vs `tka-current-module`)
  read independently at boot — latent fragility, not a current bug.
- **three.js in the eager `vendor` chunk** (loads on 2D pages too) — needs the
  svelte↔three TDZ solved first.

## Related

- Memory: `project_create_module_load_perf.md`
- Rule: `.claude/rules/fast-iteration-loop.md`, `never-hand-roll.md`
