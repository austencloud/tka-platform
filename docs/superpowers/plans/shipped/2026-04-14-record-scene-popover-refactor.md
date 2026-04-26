# Record Scene Popover Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When the Sequence Viewer is in "Record Scene" mode (renderMode='3d' + editingPane='animation'), replace the right-hand ExportVideoDrawer sidebar (desktop) / bottom sheet (mobile) with a fullscreen-canvas overlay chrome: popover buttons top-right, Record button bottom-right. Match the existing `Viewer3DGearPopover` pattern.

**Reality check (corrected premise):** "Record Scene" is NOT a standalone page or route. It's the label (`ExportVideoDrawer.svelte:61`) on the 3D variant of the video export flow inside `SequenceViewerDrawerHost` / `SequenceViewerOrchestrator`. Entered by tapping the video-export button in `ViewerFooter` while `ctx.renderMode === '3d'`. The "right-sidebar settings panel" is `ExportVideoDrawer` with `layout="sidebar"` (desktop) — see `SequenceViewerDrawerHost.svelte:432`.

**Why:** The right-hand settings column fights the intent of this mode (framing a shot). Popover buttons translate cleanly to mobile, free the canvas for full-bleed viewing, and make room for fly-camera controls already added to the viewer.

**Scope:** Only the `renderMode === '3d' && editingPane === 'animation'` branch inside `SequenceViewerDrawerHost`. Does NOT change 2D "Download Animation" export. Does NOT change the normal viewer mode. Does NOT change image export (`editingPane === 'image'`). Does NOT evolve the Stage/Compositor — that's its own project.

**Tech Stack:** Svelte 5 runes, TypeScript strict, existing `Viewer3DGearPopover` as the popover pattern reference, existing `export-options-state.svelte.ts` for settings state.

---

## The Dividing Question

When deciding where a control goes, ask: **"Does this change anything I can see or hear right now?"**
- Yes → Playback popover
- No → Export popover
- Affects performer visuals / scene → Scene popover (existing gear)

Settings that apply to both (BPM, FPS) live in Playback. Export reads whatever's current.

---

## Popover Taxonomy

### Scene (existing gear popover — keep)
- Background / environment
- Effects toggles (fire, LED, trails, charcoal)
- Performer manager (add/remove/select)
- Visibility (grid planes, etc.)
- Anything that changes what's *on* stage

### Playback (new popover)
- BPM
- Speed (Slow / Med / Fast)
- FPS (preview frame rate)
- Preview-loop on/off
- Reversals toggle
- Step mode / continuous

### Export (new popover)
- Resolution (720p / 1080p / 4K)
- Format (MP4 / WebM / GIF)
- Quality / bitrate preset
- Loop-count in exported file
- Trim range (start beat / end beat)
- Record button (prominent, not in popover — floating bottom-right)

### Playback pill (bottom-center — already exists)
- Play / pause / scrub
- Current step indicator
- Restart to start
- These stay on-surface because they're high-frequency

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│  [2D|3D]            Scene⚙  Playback▶  Export📼    │  ← top bar (overlays canvas)
│                                                     │
│                                                     │
│                                                     │
│              [FULL-BLEED 3D CANVAS]                 │
│                                                     │
│                                                     │
│                                                     │
│  Orbit|Fly        [▶  ⏮  ⏭]              [● Record]│  ← bottom bar (overlays canvas)
└─────────────────────────────────────────────────────┘
```

On mobile: same layout, popover buttons collapse to icon-only, Record button stays prominent.

---

## File Structure

**New files:**
```
src/lib/shared/sequence-viewer/components/record-scene/
├── RecordSceneChrome.svelte          — overlay chrome mounted on top of ViewerSplitPane in 3D record mode
├── RecordScenePlaybackPopover.svelte — BPM, speed, FPS, preview loop, playback mode
├── RecordSceneExportPopover.svelte   — resolution, quality, loop count, start pos / end hold, trim
└── RecordSceneRecordButton.svelte    — floating record pill (bottom-right)
```

Location rationale: these belong in `sequence-viewer/` (not `3d/components/`) because they're view-layer chrome for the viewer flow, not generic 3D primitives. The `Viewer3DGearPopover` already lives in `3d/components/` for the Scene tab — this keeps the split honest.

**Modified files:**
```
src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
  — skip ExportVideoDrawer render when renderMode==='3d' && editingPane==='animation'
  — mount RecordSceneChrome instead
  — remove the .dimension-chip button in the export-mode header (line 250-267), since the
    2D/3D pill now lives on the canvas via the popover chrome

src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
  — optional: accept a chrome snippet/slot for overlay content, OR let
    SequenceViewerDrawerHost render RecordSceneChrome as a sibling overlay. Pick one
    during step 4 when the chrome is real.

src/lib/shared/sequence-viewer/state/export-options-state.svelte.ts (READ only — no schema change)
```

**Unchanged but referenced heavily:**
```
src/lib/shared/3d/components/Viewer3DGearPopover.svelte (pattern reference for popover UX)
src/lib/shared/sequence-viewer/components/ViewerFooter.svelte (contains RenderModeToggle; the
  footer already collapses via footer-collapse.collapsed when any export mode is active, so
  during Record Scene the footer is hidden — the overlay chrome replaces it)
src/lib/shared/3d/components/Recording3DOverlay.svelte (countdown + recording indicator —
  continues to overlay during the actual capture; not part of this refactor)
```

**Deleted files:**
```
None. ExportVideoDrawer stays — it's still used for 2D animation export (editingPane==='animation'
&& renderMode==='2d'). Only skip rendering it when the condition is 3D.
```

---

## Implementation Steps

### Step 1: Confirm the inventory (premise already resolved)

Entry point is `SequenceViewerDrawerHost.svelte` lines 216-557, rendering `SequenceViewerOrchestrator` + snippet. The "Record Scene" UI is reached when `ctx.renderMode === '3d'` and `ctx.editingPane === 'animation'`.

**Today's right-sidebar panel** is `ExportVideoDrawer.svelte` with `layout="sidebar"` (line 398-onwards). Its settings, all bound to `exportOptions: ExportOptionsStateManager` from `export-options-state.svelte.ts`:
- `EffectsPanel` (BPM, play/pause, effect toggles — trail, fire, LED, charcoal)
- `PlaybackModeToggle` (continuous / step)
- FPS chips (30 / 60 / 120) — `videoFps`
- Resolution chips (720 / 1080 / 4K / 8K, square in 3D) — `videoResolution`
- Quality chips (Standard / Cinema) — `videoQuality` — **3D only**
- Timing toggles (Start Pos, End Hold) — `videoIncludeStartPosition`, `videoIncludeEndHold`
- Loop count (±, 1-10) — `videoLoopCount`
- Time estimate + total video duration display
- Export button (labeled "Record Scene" in 3D, "Download Animation" in 2D)

**Record button flow:** `ctx.handleExport` from the orchestrator. In 3D it triggers the recording pipeline that produces the MP4 via offscreen capture. The button label and icon swap in `ExportVideoDrawer` based on `renderMode`.

**Footer behavior during Record Scene:** `ViewerFooter` is force-collapsed to zero height via `.footer-collapse.collapsed` (line 470) when `isAnyExportActive` is true. So the 2D/3D pill that currently lives in the footer is NOT visible during Record Scene — the `.dimension-chip` at `SequenceViewerDrawerHost.svelte:250-267` was added to the header as a stopgap. The new overlay chrome will own the 2D/3D pill.

**Result:** No code changes in this step. The inventory is documented above; Step 2 can start immediately.

- [ ] Skim the inventory above against current files to confirm nothing drifted.
- [ ] Commit: `docs(record-scene): confirm popover refactor inventory` (only if anything was corrected)

### Step 2: Create the three popover components
- [ ] `RecordScenePlaybackPopover.svelte` — copy structure from `Viewer3DGearPopover`. Populate with BPM / Speed / FPS / Loop preview controls, reading from existing playback state.
- [ ] `RecordSceneExportPopover.svelte` — resolution, format, quality, loop count, trim. Read from `export-options-state.svelte.ts`.
- [ ] Reuse existing controls (segmented controls, toggles) from the current right panel. No new UI widgets.
- [ ] Unit test: each popover renders with default state and fires correct state setters on interaction.
- [ ] Commit: `feat(record-scene): add Playback and Export popovers`

### Step 3: Create the Record button component
- [ ] `RecordSceneRecordButton.svelte` — floating pill at bottom-right. Triggers the same service the current record button triggers.
- [ ] Handle recording-in-progress state (disabled, spinner, cancel affordance).
- [ ] Commit: `feat(record-scene): extract Record button to floating component`

### Step 4: Create the fullscreen layout shell
- [ ] `RecordSceneLayout.svelte` — full-viewport container. Slots for: canvas, top-left (2D/3D pill), top-right (popover buttons), bottom-left (fly/orbit toggle — already built), bottom-center (playback pill), bottom-right (record button).
- [ ] On mobile, popover buttons collapse to icon-only.
- [ ] No card sidebar. Full canvas.
- [ ] Commit: `feat(record-scene): add fullscreen layout shell`

### Step 5: Wire the overlay chrome into SequenceViewerDrawerHost
- [ ] In `SequenceViewerDrawerHost.svelte`, locate the block that renders `<ExportVideoDrawer>` (~line 427). Wrap that branch so it only renders when `renderMode === '2d'`.
- [ ] Add a sibling branch for `renderMode === '3d'` that mounts `<RecordSceneChrome>` absolutely positioned over the canvas area (inside `.viewer-and-export` but layered above `ViewerSplitPane`). Pass the popovers as children or slots, plus `exportOptions`, `bpm`, `isPlaying`, `playbackMode`, playback callbacks, `handleExport`, and `handleCancelExport`.
- [ ] In 3D record mode, do NOT expand the desktop sidebar column (keep `grid-template-columns: 1fr 0px`). This is already the behavior when `isAnyExportActive` is false; the effect is achieved by not toggling `export-active` for 3D. Simplest path: don't apply `.export-active` when `renderMode === '3d'`, or add a new class guard. Confirm transition smoothness on entry/exit.
- [ ] The mobile bottom sheet (`layout="bottom"` variant of ExportVideoDrawer) also stops rendering in 3D — the same `renderMode === '2d'` guard covers it.
- [ ] Remove the `.dimension-chip` button at lines 250-267 of `SequenceViewerDrawerHost.svelte` — the 2D/3D pill now lives inside `RecordSceneChrome`.
- [ ] Keep `Recording3DOverlay` (lines 391-401) untouched — the countdown / recording indicator continues to work.
- [ ] Keep back-navigation unchanged — `ctx.exitEditMode` still fires from the existing drawer header back button, which remains for 3D mode too. (We're replacing the settings *panel*, not the drawer's back button.)
- [ ] Commit: `feat(record-scene): swap sidebar for overlay popover chrome in 3D mode`

### Step 6: Mobile verification
- [ ] Test on iPhone-size and Android-size viewports via responsive mode.
- [ ] Verify popovers don't clip off-screen; they should anchor from their trigger button.
- [ ] Verify the Record button is thumb-reachable.
- [ ] Verify the fly-camera toggle is hidden on touch (already gated in `Viewer3DCanvas`).
- [ ] Commit: `fix(record-scene): mobile popover positioning and touch targets`

### Step 7: Cleanup pass
- [ ] `ExportVideoDrawer.svelte` is still used for 2D — do NOT delete it. Leave its sidebar and bottom layouts intact.
- [ ] The `.sidebar-collapsed` class and the sidebar-toggle header button (line 269-280 of `SequenceViewerDrawerHost.svelte`) are still used in 2D animation export and image export — leave them. If they turn out to be unused after this refactor (they won't), that's a separate cleanup.
- [ ] Confirm the `.dimension-chip` was removed in Step 5.
- [ ] Run `npm run check` — no errors in touched files.
- [ ] Commit: `chore(record-scene): remove dimension chip header button`

### Step 8: Verification pass
- [ ] Record a short sequence end-to-end: load sequence → enter Record Scene → adjust BPM in Playback popover → adjust resolution in Export popover → hit Record → video file produced.
- [ ] Verify settings persist across close/reopen (they already do via `export-options-state`).
- [ ] Verify fly camera works during recording.
- [ ] Take screenshots of desktop + mobile layout for the user.
- [ ] Commit: `test(record-scene): verification pass with screenshots`

---

## Open Questions (flag to user before starting)

1. ~~Where does Record Scene live today?~~ **Resolved:** 3D mode of `SequenceViewerOrchestrator` inside `SequenceViewerDrawerHost`. See Step 1.
2. **Does the record pipeline already know about fly camera?** If the current recorder is hard-wired to orbit-mode camera transforms, fly-mode recordings may jitter. Flag during step 2.
3. **Should Loop Preview (playback) and Loop Count (export) share a control?** Different — one affects what you see, the other affects what's written. Keep separate unless user wants them linked.
4. **Is there a "camera keyframe" feature planned for recording?** If so, a fourth popover (Camera Path) may be needed. Deferred — not in this plan.
5. **Should the desktop "collapse sidebar" header button survive in 3D mode?** Currently it toggles `exportSidebarCollapsed`. In 3D the sidebar won't exist at all, so the button becomes meaningless. Step 5 already hides the `.dimension-chip`; confirm whether the settings-toggle button (line 269-280) should also be gated to `renderMode === '2d'`.

---

## Non-Goals

- Click-to-select performer (belongs in Stage/Compositor — separate project)
- Per-beat per-performer config (belongs in Stage/Compositor)
- Multi-performer timeline editor (belongs in Stage/Compositor)
- Keyframed camera paths (deferred, see open question 4)
- Replacing the video recording pipeline itself

---

## Rollback

The refactor is layout-only. State schema (`export-options-state.svelte.ts`) doesn't change. If the new layout has issues, the prior right-sidebar layout can be reintroduced by reverting the Step 5 commit — state persists across both.
