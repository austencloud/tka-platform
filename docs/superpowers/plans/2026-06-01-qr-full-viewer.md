# QR Full-minus-3D Viewer Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the 2D animation, choreo card, mandala (undulation), and side-by-side views to `/q/[code]` by reusing `SequenceViewerOrchestrator`, while lazy-loading Three.js out of the shared `ViewerSplitPane` so the scan page stays lightweight.

**Architecture:** Approach A — `/q/[code]` mounts `SequenceViewerOrchestrator` (`forceGuest`, `initialRenderMode='2d'`) and supplies a `children` snippet rendering `ViewerSplitPane` (non-3D `splitConfig`) + a QR shell (share, Open TKA CTA, ExportTakeover). A shared edit converts `ViewerSplitPane`'s 3D component imports (`Viewer3DCanvas`, `PerformerHub`) to dynamic so Three.js leaves the eager bundle.

**Tech Stack:** SvelteKit, Svelte 5 runes, Threlte (3D, lazy), existing viewer factory modules.

**Verification model:** This is Svelte UI/integration + empirical bundle work. Per the project testing philosophy, verify via `npm run check` (types), `npm run build` (bundle/chunk inspection), and runtime in the browser — not unit-test-per-step.

---

## Task 1: Lazy-load 3D out of `ViewerSplitPane` (shared, highest risk)

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte`

The 3D-heavy components (`Viewer3DCanvas` line 20, `PerformerHub` line 25) are statically imported, so Three.js rides in any chunk importing the split pane. They are already gated behind `_3dLeftMounted` / `splitConfig.rightPane === 'animation-3d'` (which never become true on the QR page). Convert the imports to dynamic so the gating also gates the bundle.

- [ ] **Step 1: Remove the two static 3D component imports.**

Delete lines 20 and 25:
```svelte
import Viewer3DCanvas from "$lib/shared/3d/components/Viewer3DCanvas.svelte";
...
import PerformerHub from "$lib/shared/3d/components/controls/PerformerHub.svelte";
```
Keep `RightRail` (line 24) static — it's used for the 2D rail too; verify in Step 5 whether it drags Three.js (if so, lazy-gate its 3D path separately).

- [ ] **Step 2: Lazy-resolve the 3D components into state, gated on 3D ever being needed.**

Add after the props block (near line 146):
```svelte
// Three.js is multi-MB; only import the 3D canvas + performer hub once a 3D
// pane is actually activated. Gated panes (_3dLeftMounted / rightPane==='animation-3d')
// never flip true on the lightweight QR landing page, so it never loads there.
let Viewer3DCanvas = $state<typeof import("$lib/shared/3d/components/Viewer3DCanvas.svelte").default | null>(null);
let PerformerHub = $state<typeof import("$lib/shared/3d/components/controls/PerformerHub.svelte").default | null>(null);
const needs3D = $derived(
  splitConfig.leftPane === 'animation-3d' || splitConfig.rightPane === 'animation-3d'
);
$effect(() => {
  if (needs3D && !Viewer3DCanvas) {
    void Promise.all([
      import("$lib/shared/3d/components/Viewer3DCanvas.svelte"),
      import("$lib/shared/3d/components/controls/PerformerHub.svelte"),
    ]).then(([canvas, hub]) => {
      Viewer3DCanvas = canvas.default;
      PerformerHub = hub.default;
    });
  }
});
```

- [ ] **Step 3: Guard the three render sites with the resolved component.**

Left pane (line ~367): wrap the `<Viewer3DCanvas .../>` in `{#if Viewer3DCanvas}`.
Right pane (line ~605): same wrap.
Rail (line ~456-461): wrap `<PerformerHub />` in `{#if PerformerHub}` (the `<RightRail renderMode="3d" />` stays as-is unless Step 5 shows it pulls Three.js).

Example (left pane):
```svelte
<div class="canvas-layer canvas-3d-layer" style="opacity:1;pointer-events:auto;">
  {#if Viewer3DCanvas}
    <Viewer3DCanvas
      sequenceData={playback.animationState.sequenceData}
      currentStep={playback.currentStep}
      isPlaying={playback.isPlaying}
      {bpm}
      {onBpmChange}
      bluePropType={propRendering.bluePropType != null ? String(propRendering.bluePropType) : null}
      redPropType={propRendering.redPropType != null ? String(propRendering.redPropType) : null}
      hideOverlays={false}
      fullScreen={layout.focusedPane === "animation"}
      onExitFullScreen={onUnfocusPane}
      {onPlaybackToggle}
      {onProgressBarSeek}
      {playbackMode}
      {onPlaybackModeChange}
    />
  {/if}
</div>
```

- [ ] **Step 4: Gate the eager 3D scene-asset preload.**

`onMount(() => startSceneAssetPreload())` (line ~149) kicks off 3D asset fetching even in 2D. Gate it so the QR page (and 2D-only viewer states) skip it until 3D is needed:
```svelte
$effect(() => {
  if (needs3D) startSceneAssetPreload();
});
```
Remove the unconditional call from `onMount`. (If `startSceneAssetPreload` is idempotent/cheap this is still correct — it avoids the 3D loader import path on 2D-only pages.)

- [ ] **Step 5: Build and inspect the QR chunk for Three.js.**

Run: `npm run build > /tmp/qr-build.log 2>&1; echo EXIT=$?`
Then inspect whether `three` / `threlte` still land in the `/q/[code]` route chunk. If they do, the remaining importer is `RightRail` (3D path) or `scene-3d-render-state` / `scene-asset-preloader`. Lazy-gate the next offender the same way (dynamic import behind `needs3D`). Iterate until the QR path is Three-free.

- [ ] **Step 6: Regression-check the main viewer's desktop 3D.**

Run `npm run check` (capture once). Then runtime: confirm `/sequence/[id]` desktop 3D split still activates and renders (the dynamic import resolves on first 3D activation). This is the gate before committing — `ViewerSplitPane` is shared.

- [ ] **Step 7: Commit.**

```bash
git commit -m "perf(viewer): lazy-load Three.js out of ViewerSplitPane" -- src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
```

---

## Task 2: Rewrite `/q/[code]/+page.svelte` to mount the orchestrator

**Files:**
- Modify: `src/routes/q/[code]/+page.svelte`

Replace the bare `AnimationPlayer` mount with `SequenceViewerOrchestrator` + a `children` snippet. Keep the existing loading/error states, scan analytics, prop state, and `@` layout breakout.

- [ ] **Step 1: Swap the dynamic player import for the orchestrator.**

The page lazily imports `AnimationPlayer` today (line ~351). Replace with a lazy import of `SequenceViewerOrchestrator` (and statically import `ViewerSplitPane`, `ComparisonModeBar`, `ToastContainer` — they're light without Task 1's Three.js). Keep the `Promise.all` resolve+cache shape; just change the imported module.

- [ ] **Step 2: Add the orchestrator + children snippet in the `playing` branch.**

Replace the `.canvas-area` `AnimationPlayer` block with:
```svelte
<SequenceViewerOrchestrator
  sequence={resolvedSeq}
  isMobile={!isSidebarLayout}
  forceGuest={true}
  initialRenderMode="2d"
  initialBpm={selectedBpm}
  onClose={() => goto(`/browse/gallery?from=scan&code=${shortCode}`)}
>
  {#snippet children(ctx)}
    <div class="qr-viewer-body">
      <ViewerSplitPane
        sequence={ctx.effectiveSequence}
        renderMode="2d"
        bpm={ctx.bpmLocal}
        onBpmChange={ctx.handleBpmChange}
        playback={ctx.splitPanePlayback}
        imageComposition={ctx.splitPaneImageComposition}
        propRendering={ctx.splitPanePropRendering}
        layout={{
          isFullscreen: false,
          fullscreenStackVertical: false,
          isMobile: !isSidebarLayout,
          isLandscapeMobile: false,
          focusedPane: ctx.editingPane,
          suppressCloseButton: ctx.editingPane !== null,
        }}
        splitConfig={qrSplitConfig}
        onSplitConfigReplace={(c) => (qrSplitConfig = c)}
        onFocusPane={ctx.enterEditMode}
        onUnfocusPane={ctx.exitEditMode}
        onStepClick={ctx.handleStepClick}
        onCanvasReady={ctx.handleCanvasReady}
        onPlaybackToggle={ctx.handlePlaybackToggle}
        onProgressBarSeek={ctx.handleProgressBarSeek}
      />
      <!-- QR shell: prop selector, share, Open TKA CTA -->
      <QrShell ... />
      <ExportTakeover ... driven by ctx.exportProgress ... />
    </div>
  {/snippet}
</SequenceViewerOrchestrator>
<ToastContainer />
```
Add `let qrSplitConfig = $state<SplitConfig>({ leftPane: 'animation', rightPane: 'card' });` and import `SplitConfig` from `../services/viewer-state-persistence` (verify path). Verify the exact `ctx` field names against the `OrchestratorContext` type and the `/sequence/[id]` route usage (lines 600-700) during execution; adjust any that differ (`handleProgressBarSeek` vs `onProgressBarSeek` etc.).

- [ ] **Step 3: Non-3D comparison-mode switcher.**

`ComparisonModeBar` renders inside `ViewerSplitPane` (line 332) only when `!layout.isMobile && onSplitConfigReplace`. Confirm its option set excludes `animation-3d`; if it includes a 3D mode, pass/add a filter so the QR switcher offers only animation / card / mandala / their side-by-side combinations. (Inspect `ComparisonModeBar.svelte` + `COMPARISON_MODE_LAYOUTS` during execution.)

- [ ] **Step 4: Reconcile export — drive `ExportTakeover` from the orchestrator.**

Keep `ExportTakeover`. Map `ctx.exportProgress` → `ExportPhase` (reuse the existing `takeoverPhase`/`takeoverLabel` deriveds, repointed at `ctx`). Trigger export via `ctx.handleExport`. Remove the page's bespoke `handleDownload`/`VideoExportOrchestrator` wiring (the orchestrator's export coordinator replaces it) unless `ctx.handleExport` lacks the share-sheet behavior — if so, keep `shareOrDownloadBlob` as the post-export delivery step. Confirm only one overlay renders (no viewer `ExportProgressOverlay`).

- [ ] **Step 5: Preserve prop selection.**

Route the QR prop selector to `ctx.handlePropTypeChange` (syncs settings + re-renders), replacing the local `selectedProp`/`handlePropChange`. Seed from `resolvedSeq.intendedProp` as today. Verify `ctx` exposes the prop-change handler; if not, keep the local prop state and thread `bluePropType`/`redPropType` through the orchestrator props.

- [ ] **Step 6: `npm run check` (capture once), fix type errors in touched files.**

Run: `npm run check > /tmp/qr-check2.log 2>&1`; grep for `q/[code]` + `ViewerSplitPane` errors; fix until clean.

- [ ] **Step 7: Commit.**

```bash
git commit -m "feat(qr): mount full-minus-3D viewer on /q/[code]" -- "src/routes/q/[code]/+page.svelte"
```

---

## Task 3: Verify + measure

- [ ] **Step 1: Build, confirm success + inspect QR chunk weight.**

Run: `npm run build`. Confirm success. Compare `/q/[code]` chunk size vs the pre-change build; confirm no eager `three`/`threlte`.

- [ ] **Step 2: Runtime (browser) verification.**

On a narrow/portrait viewport at `/q/<realcode>`: cycle animation / card / mandala / side-by-side; confirm the mandala undulation Speed slider works; confirm via DevTools network that no Three.js chunk loads; confirm share sheet + Open TKA CTA + ExportTakeover still function. (Requires the user's go-ahead for interactive DevTools, or hand off the specific checklist.)

- [ ] **Step 3: Regression — `/sequence/[id]` desktop 3D split still renders.**

- [ ] **Step 4: Push.**

```bash
git push origin main
```

---

## Self-review

- **Spec coverage:** Work Item 1 → Task 1; Work Item 2 → Task 2 (Steps 1-3, 6-7); Work Item 3 (control reconciliation) → Task 2 (Steps 3-5); bootstrap → handled by `forceGuest` + `ToastContainer` (Task 2 Step 2); verification → Task 3. All spec sections covered.
- **Open verification points flagged inline** (exact `ctx` field names, `ComparisonModeBar` option set, whether `RightRail` drags Three.js) are resolved empirically during execution, not guessed — each step says how.
- **Risk-ordered:** the shared `ViewerSplitPane` edit (Task 1) lands + regression-checks before the QR rewrite depends on it.
