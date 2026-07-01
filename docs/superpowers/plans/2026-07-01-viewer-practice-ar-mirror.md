# Viewer Practice — Passive AR Mirror (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo rule (overrides skill default):** NO git worktree, NO branch. All work on `main` (user CLAUDE.md). Commit each task with an **explicit pathspec** (`git commit -m "…" -- <files>`) — the index is shared with other agents; never a bare `git commit`.
>
> **Inner loop:** use `npm run check:watch` (start once, background) for types + the dev server on :5173 for runtime. Do NOT run full `npm run check`/`build` per task — only the one full `check` at the final gate.

**Goal:** Give viewer practice an optional passive AR mirror — the webcam behind the transparent animation canvas so you can watch yourself play along. No hit-detection, no scoring, no judgment (that is P2). Off by default; only starts the camera when the user toggles it on.

**Architecture:** Reuse the existing `CameraPreview.svelte` mirror primitive (it already wraps the shared `CameraManager`, mirrors the feed, owns init/error/retry). Relocate it from `features/train/` to `shared/train/` so the viewer (in `shared/`) can import it without an up-layer dependency. Add a `mirrorEnabled` view-pref that flows through the exact same chain the working `metronomeEnabled` toggle already uses (pref → `playback-controller` → `SequenceViewerOrchestrator` ctx → `SequenceViewerDrawerHost` → `PracticeBar`). Render `CameraPreview` as an absolute layer behind the left practice canvas and set the canvas background transparent when the mirror is on.

**Tech Stack:** Svelte 5 runes, `getUserMedia` via `CameraManager`, localStorage-persisted view prefs, `AnimatorCanvas` `backgroundAlpha`.

**Scope cuts (deliberate, name them — do not silently expand):**
- Toggle lives only in the running cockpit (`PracticeBar`), not the setup bar. You enable the mirror live while practicing.
- Mirror sits behind the **left** animation canvas only (the primary practice canvas). Not the right/strip pane.
- No MediaPipe, no grid overlay, no detection, no scoring — that is P2 per the consolidation spec.
- No new automated test: this is a structural mirror of the already-working `metronomeEnabled` toggle; the only novel surface (camera actually rendering behind the canvas) is inherently manual-verify. Per `component-test-discipline.md`, tests are added on-fix, not on-add.

**Reference precedent (read before starting):** the `metronomeEnabled` wiring is the template. It appears in exactly these places — every mirror change is parallel to one of these:
- `src/lib/shared/sequence-viewer/state/practice-view-prefs.svelte.ts` (pref)
- `src/lib/shared/sequence-viewer/components/playback-controller.svelte.ts:361` (`handleToggleMetronome`), `:453` (getter), `:477` (export)
- `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte:65-66` (ctx type), `:1010-1011` (ctx value)
- `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte:774-775` (pass to `PracticeBar`)
- `src/lib/shared/sequence-viewer/components/PracticeBar.svelte:38-40` (props), `:222-232` (Sound toggle button)

---

## Task 1: Add `mirrorEnabled` view-pref

**Files:**
- Modify: `src/lib/shared/sequence-viewer/state/practice-view-prefs.svelte.ts`

- [ ] **Step 1: Add `mirrorEnabled` to the persisted shape + fallback**

In `interface PersistedPrefs` (currently lines 33-37), add the field after `metronomeEnabled`:

```ts
interface PersistedPrefs {
  splitPreset: SplitPreset;
  readAheadDepth: number;
  metronomeEnabled: boolean;
  mirrorEnabled: boolean;
}
```

In `load()`'s `fallback` (line 40), add `mirrorEnabled: false` (off by default — the camera must never start unprompted):

```ts
const fallback: PersistedPrefs = { splitPreset: "lane-heavy", readAheadDepth: 2, metronomeEnabled: false, mirrorEnabled: false };
```

In the returned parse object (lines 46-50), add after the `metronomeEnabled` line:

```ts
      mirrorEnabled: parsed.mirrorEnabled ?? fallback.mirrorEnabled,
```

- [ ] **Step 2: Add the rune, persistence, getter, and setter**

After `let metronomeEnabled = $state<boolean>(initial.metronomeEnabled);` (line 61):

```ts
  let mirrorEnabled = $state<boolean>(initial.mirrorEnabled);
```

In `persist()` (line 65), add `mirrorEnabled` to the serialized object:

```ts
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ splitPreset, readAheadDepth, metronomeEnabled, mirrorEnabled }));
```

In the returned object, after `get metronomeEnabled()` (line 76) and after `setMetronomeEnabled` (line 79):

```ts
    get mirrorEnabled() { return mirrorEnabled; },
```
```ts
    setMirrorEnabled(v: boolean) { mirrorEnabled = v; persist(); },
```

- [ ] **Step 3: Verify types**

Watch the `npm run check:watch` output. Expected: no new errors in `practice-view-prefs.svelte.ts`. (The `PracticeViewPrefs` type at line 83 is `ReturnType<typeof createPracticeViewPrefs>`, so the new getter/setter propagate automatically.)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(practice): add mirrorEnabled view-pref (off by default)" -- src/lib/shared/sequence-viewer/state/practice-view-prefs.svelte.ts
```

---

## Task 2: Relocate `CameraPreview` to `shared/train/`

The viewer lives in `shared/sequence-viewer/` and cannot import from `features/train/` (up-layer). `CameraPreview.svelte` already depends only on `$lib/shared/train/services/camera-manager` + `$lib/shared/components/loading/ProgressRing` + i18n — all shared — so it moves cleanly.

**Files:**
- Create: `src/lib/shared/train/components/CameraPreview.svelte` (moved content)
- Delete: `src/lib/features/train/components/CameraPreview.svelte`
- Modify: `src/lib/features/train/components/practice/CameraSection.svelte:9` (import path)

- [ ] **Step 1: Find every importer of CameraPreview**

Run:
```bash
grep -rn "components/CameraPreview" src/lib
```
Expected: one hit — `src/lib/features/train/components/practice/CameraSection.svelte:9` (`import CameraPreview from "../CameraPreview.svelte";`). If more appear, each gets its import path updated in Step 4.

- [ ] **Step 2: Move the file**

```bash
git mv src/lib/features/train/components/CameraPreview.svelte src/lib/shared/train/components/CameraPreview.svelte
```
(The `shared/train/` dir already exists — `services/camera-manager.ts` lives there. If `shared/train/components/` does not yet exist, `git mv` creates it.)

- [ ] **Step 3: Verify the moved file's imports still resolve**

`CameraPreview.svelte` imports `$lib/shared/train/services/camera-manager`, `$lib/shared/components/loading/ProgressRing`, `$lib/shared/i18n/i18n.svelte.js` — all absolute `$lib` paths, unaffected by the move. No edit needed inside the file. Confirm via `check:watch` that no unresolved-import error appears for it.

- [ ] **Step 4: Fix the importer in CameraSection**

In `src/lib/features/train/components/practice/CameraSection.svelte`, change line 9:

```svelte
  import CameraPreview from "$lib/shared/train/components/CameraPreview.svelte";
```
(was `import CameraPreview from "../CameraPreview.svelte";`)

- [ ] **Step 5: Verify types**

`check:watch`: no unresolved-import errors for `CameraPreview` in `CameraSection.svelte` or anywhere else.

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor(practice): relocate CameraPreview to shared/train for viewer reuse" -- src/lib/shared/train/components/CameraPreview.svelte src/lib/features/train/components/CameraPreview.svelte src/lib/features/train/components/practice/CameraSection.svelte
```

---

## Task 3: Expose the mirror toggle on the playback controller

Parallel to `handleToggleMetronome` (`playback-controller.svelte.ts:361-364`) but simpler — the mirror is a pure boolean; it needs no beat-tick side effect.

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/playback-controller.svelte.ts`

- [ ] **Step 1: Add the toggle function**

Immediately after `handleToggleMetronome` (ends ~line 364), add:

```ts
  function handleToggleMirror() {
    const next = !(_practiceViewPrefs?.mirrorEnabled ?? false);
    _practiceViewPrefs?.setMirrorEnabled(next);
  }
```

- [ ] **Step 2: Add the getter to the returned object**

Next to `get metronomeEnabled()` (line 453):

```ts
    get mirrorEnabled() { return _practiceViewPrefs?.mirrorEnabled ?? false; },
```

- [ ] **Step 3: Export the toggle**

In the returned object next to `handleToggleMetronome,` (line 477):

```ts
    handleToggleMirror,
```

- [ ] **Step 4: Verify types + commit**

`check:watch`: clean.
```bash
git commit -m "feat(practice): expose mirror toggle on playback controller" -- src/lib/shared/sequence-viewer/components/playback-controller.svelte.ts
```

---

## Task 4: Thread mirror state through the orchestrator ctx

Parallel to `metronomeEnabled` / `handleToggleMetronome` in `SequenceViewerOrchestrator.svelte`.

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`

- [ ] **Step 1: Add to the ctx type**

After the ctx type lines (65-66):
```ts
    metronomeEnabled: boolean;
    handleToggleMetronome: () => void;
```
add:
```ts
    mirrorEnabled: boolean;
    handleToggleMirror: () => void;
```

- [ ] **Step 2: Add to the ctx value**

After (lines 1010-1011):
```ts
    metronomeEnabled: playback.metronomeEnabled,
    handleToggleMetronome: playback.handleToggleMetronome,
```
add:
```ts
    mirrorEnabled: playback.mirrorEnabled,
    handleToggleMirror: playback.handleToggleMirror,
```

- [ ] **Step 3: Verify types + commit**

`check:watch`: clean.
```bash
git commit -m "feat(practice): thread mirror state through viewer orchestrator ctx" -- src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
```

---

## Task 5: Render the mirror behind the left practice canvas

The primary practice canvas is the left column's `.canvas-2d-layer` inside `.media-pane.persistent-2d` (`ViewerSplitPane.svelte:551-582`). Insert `CameraPreview` as an absolute layer beneath it, mounted only when `practiceActive && practiceMirrorEnabled`, and make the canvas background transparent in that case so the feed shows through.

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte`

- [ ] **Step 1: Import CameraPreview**

Near the other component imports (after line 23, `import PracticeCountInOverlay …`):

```svelte
  import CameraPreview from "$lib/shared/train/components/CameraPreview.svelte";
```

- [ ] **Step 2: Accept the new prop**

`ViewerSplitPane` already receives `practiceActive` / `practiceRunning` / `practiceCountdown` / `practiceCellSize` / `practiceCanvasFraction` (destructured from `$props()`; passed at `SequenceViewerDrawerHost.svelte:610-614`). Add `practiceMirrorEnabled` alongside them in the `Props` interface and the `$props()` destructure, defaulting `false`:

In the `Props` interface add:
```ts
    practiceMirrorEnabled?: boolean;
```
In the destructure add (with the other practice props):
```ts
    practiceMirrorEnabled = false,
```
(If the practice props are pulled from a typed group object rather than individually, follow that same shape — grep `practiceCellSize` in this file to see exactly how the sibling props are declared, and add `practiceMirrorEnabled` the identical way.)

- [ ] **Step 3: Insert the mirror layer behind the canvas**

In the left column, inside the `{:else}` that renders `.canvas-2d-layer` (line 550-554), add the mirror layer immediately BEFORE the `<div class="canvas-layer canvas-2d-layer" …>`:

```svelte
        {:else}
          {#if practiceActive && practiceMirrorEnabled}
            <div class="practice-mirror-layer">
              <CameraPreview mirrored={true} />
            </div>
          {/if}
          <div
            class="canvas-layer canvas-2d-layer"
            style="opacity:1;pointer-events:auto;"
          >
```

- [ ] **Step 4: Make the canvas transparent when the mirror is on**

`AnimatorCanvas` supports `backgroundAlpha` (see the reference usage in `CameraSection.svelte:175` — `backgroundAlpha={0}`). On the left-column `AnimatorCanvas` (starts line 555), add the prop so the feed shows through only when mirroring:

```svelte
              backgroundAlpha={practiceActive && practiceMirrorEnabled ? 0 : 1}
```
Add it among the existing props (e.g. right after `redPropType={propRendering.redPropType}` on line 567). Do NOT touch the right-column canvas.

- [ ] **Step 5: Style the mirror layer**

In the `<style>` block, add (place near the `.canvas-layer` rules):

```css
  /* Passive AR mirror — webcam behind the practice canvas. Fills the pane,
     sits under the transparent canvas. z-index below .canvas-2d-layer. */
  .practice-mirror-layer {
    position: absolute;
    inset: 0;
    z-index: 0;
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
  }
```
Confirm `.canvas-2d-layer` establishes a stacking context above 0 (it has `opacity:1` inline and lives later in DOM order; if it does not already carry a `z-index`, add `z-index: 1` to the `.canvas-2d-layer` rule in this file's style block so it reliably paints above the mirror).

- [ ] **Step 6: Verify types**

`check:watch`: no errors in `ViewerSplitPane.svelte`. In particular confirm `backgroundAlpha` is a valid `AnimatorCanvas` prop (it is used in `CameraSection.svelte`); if the linter flags it, open `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte`, confirm the prop name, and match it.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(practice): render passive AR mirror behind viewer practice canvas" -- src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
```

---

## Task 6: Pass the prop + add the cockpit toggle button

Wire the DrawerHost to feed `practiceMirrorEnabled` into `ViewerSplitPane` and `mirrorOn`/`onToggleMirror` into `PracticeBar`, then add the toggle button to `PracticeBar` (a copy of the Sound/metronome button).

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/PracticeBar.svelte`

- [ ] **Step 1: Feed the prop into ViewerSplitPane**

In `SequenceViewerDrawerHost.svelte`, after the practice props on the split-pane component (lines 610-614, ending `practiceCanvasFraction={0.5}`), add:

```svelte
                      practiceMirrorEnabled={ctx.mirrorEnabled}
```

- [ ] **Step 2: Feed props into PracticeBar**

In the `<PracticeBar … />` instantiation (lines 765-776), after `onToggleMetronome={ctx.handleToggleMetronome}` (line 775), add:

```svelte
                  mirrorOn={ctx.mirrorEnabled}
                  onToggleMirror={ctx.handleToggleMirror}
```

- [ ] **Step 3: Add the two props to PracticeBar**

In `PracticeBar.svelte`, in the `Props` interface after `onToggleMetronome` (line 40):

```ts
    /** Whether the AR mirror (webcam behind canvas) is on. */
    mirrorOn: boolean;
    /** Toggle the AR mirror on/off. */
    onToggleMirror: () => void;
```

And add both to the destructure on line 43:

```ts
  let { progress, bpm, isPlaying, onBpmChange, onStepLevel, onToggleHold, onPlayPause, onStop, metronomeOn, onToggleMetronome, mirrorOn, onToggleMirror }: Props = $props();
```

- [ ] **Step 4: Add the toggle button (copy of the Sound button)**

Immediately after the metronome/Sound button block (`pb-sound`, lines 222-232), add a mirror button using the same structure and the shared `.pb-sound`-style visual language. Give it its own class `pb-mirror` plus reuse `.pb-sound` states by adding `pb-mirror` to the `.pb-sound.on` selector, OR duplicate the on-state. Use the duplicate for clarity:

```svelte
    <button
      class="pb-btn pb-mirror"
      class:on={mirrorOn}
      type="button"
      onclick={onToggleMirror}
      aria-label={mirrorOn ? "Hide camera mirror" : "Show camera mirror"}
      aria-pressed={mirrorOn}
    >
      <i class="fas {mirrorOn ? 'fa-video' : 'fa-video-slash'}" aria-hidden="true"></i>
      <span>{mirrorOn ? "Mirror" : "Mirror"}</span>
    </button>
```

- [ ] **Step 5: Style the button**

In `PracticeBar.svelte`'s `<style>`, after the `.pb-sound` rules (lines 346-366), add a `.pb-mirror` block that reuses the same visual treatment (copy the `.pb-sound` + `.pb-sound.on` + hover rules, renaming the selector to `.pb-mirror`):

```css
  /* Mirror — toggle that shows the webcam behind the canvas; mirrors Hold/Sound. */
  .pb-mirror {
    flex-direction: column;
    gap: 1px;
    width: 62px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.14));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .pb-mirror i { font-size: 16px; }
  @media (hover: hover) and (pointer: fine) {
    .pb-mirror:hover { background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12)); color: var(--theme-text, #fff); }
  }
  .pb-mirror.on {
    background: color-mix(in srgb, var(--theme-accent, #38bdf8) 26%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #38bdf8) 55%, transparent);
    color: color-mix(in srgb, var(--theme-accent, #7dd3fc) 75%, white);
  }
```

- [ ] **Step 6: Verify types**

`check:watch`: clean across `SequenceViewerDrawerHost.svelte` and `PracticeBar.svelte`. Confirm no "missing required prop `mirrorOn`/`onToggleMirror`" error anywhere `PracticeBar` is used (grep `<PracticeBar` — there should be the single DrawerHost usage).

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(practice): add AR mirror toggle to practice cockpit bar" -- src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte src/lib/shared/sequence-viewer/components/PracticeBar.svelte
```

---

## Task 7: Full check + manual verification

- [ ] **Step 1: One full type check**

Run once (capture to a log, per fast-iteration rule):
```bash
npm run check > /tmp/check.log 2>&1
grep -niE "error" /tmp/check.log
```
Expected: no new errors introduced by the six edited files. Fix any before proceeding.

- [ ] **Step 2: Manual runtime verification (camera cannot be granted headless — needs the user)**

The camera-behind-canvas cannot be verified without a real getUserMedia grant. Per `verification-protocol.md`, hand off with a specific ask. Tell the user, with a clickable link:

> Open [localhost:5173](https://localhost:5173), open any sequence in the viewer, hit **Practice**, **Start** the ramp, then tap the new **Mirror** button in the cockpit bar. Confirm: (1) browser prompts for camera once, (2) your mirrored webcam appears behind the animation with the props drawn over it, (3) tapping Mirror again hides the feed and the camera light goes off, (4) exiting practice also stops the camera. Tell me what you see.

- [ ] **Step 3: Confirm no camera access before opt-in**

Ask the user to also confirm the camera does NOT activate on entering practice — only after tapping Mirror (mirrorEnabled defaults false). This is the privacy guarantee.

---

## Self-Review (completed by plan author)

- **Spec coverage:** P1 in `2026-07-01-practice-consolidation-design.md` = "relocate AR overlay to shared; wire passive AR mirror into viewer (camera behind canvas, no scoring)." Task 2 relocates the primitive; Tasks 1/3/4/5/6 wire the passive mirror; scoring is explicitly excluded (P2). Covered.
- **Placeholder scan:** every code step shows the exact code; no TBD/TODO. The two "grep to confirm shape" instructions (Task 5 Step 2, Task 6 Step 6) are verification steps, not placeholders — the concrete edit is given, the grep guards the assumption.
- **Type consistency:** getter/setter names `mirrorEnabled` / `setMirrorEnabled` (Task 1) → consumed as `_practiceViewPrefs?.mirrorEnabled` / `setMirrorEnabled` (Task 3) → `playback.mirrorEnabled` / `handleToggleMirror` (Task 4) → `ctx.mirrorEnabled` / `ctx.handleToggleMirror` (Task 6) → `mirrorOn` / `onToggleMirror` props (Task 6). Prop name `practiceMirrorEnabled` consistent between DrawerHost pass (Task 6 Step 1) and ViewerSplitPane accept (Task 5 Step 2). Consistent.
```
