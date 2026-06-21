# QR Live Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the QR scan page's MP4 web worker rendering pipeline with a lazy-loaded `AnimationPlayer` component that plays live 2D Canvas animation using the production animation engine.

**Architecture:** The existing `AnimationPlayer` component (which wraps `AnimatorCanvas` → `AnimationEngine` → `Canvas2DAnimationRenderer`) is lazy-loaded after shortcode resolution. The `<video>` element, web worker pipeline, R2 cache check/upload, and `HeadlessAnimationOrchestrator` usage are removed from the QR page. Prop/effect switching updates reactive props — no worker re-spawn. Download uses the existing `VideoExportOrchestrator` export flow.

**Tech Stack:** Svelte 5 (runes), SvelteKit 2.61, Canvas 2D animation engine, `createEffectsConfigState()` for effects, `getVideoExportOrchestrator()` factory for downloads.

---

### Task 1: Rewrite `+page.svelte` script — remove MP4 pipeline, add AnimationPlayer lazy-load

**Files:**
- Modify: `src/routes/q/[code]/+page.svelte` (entire `<script>` block rewrite)

This task replaces the entire script section. The template and styles come in Task 2.

- [ ] **Step 1: Remove all MP4-pipeline imports and add new ones**

Remove these imports:
```
HeadlessAnimationOrchestrator
buildTimelineParams, calculateFrameTiming
WorkerOutMessage, RenderRequest, PrecomputedFrame, TransferableAssets
loadAssets, loadLetterGlyphs, LoadedAssets
getLetterImagePath
Letter
```

Remove unused imports:
```
encodeSequence (only used by computeHash which is being removed)
```

Keep `isInlineEncoded` (used for analytics detection).

Add new imports:
```typescript
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/implementations/AnimationPlaybackController";
import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
```

- [ ] **Step 2: Replace state declarations**

Remove all video/worker state:
```
videoEl, paused, displayTime, duration, playbackRate, isScrubbing
bgRenderPercent, bgRenderPhase, activeWorker, currentBlobUrl
```

Remove the `PageState` type's `rendering` and `playing` variants. Replace with:
```typescript
type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "playing"; word: string };

let pageState = $state<PageState>({ kind: "loading" });
let resolvedSeq: SequenceData | null = $state(null);
let seqWord = $state("");
let selectedProp = $state(PropType.STAFF);
let selectedEffect: EffectType = $state("trails");
let showPropOverlay = $state(false);
let showEffectOverlay = $state(false);
let propSectionOpen = $state(false);
let effectSectionOpen = $state(false);
let selectedBpm = $state(BASE_BPM);

let AnimationPlayerComponent: typeof import("$lib/shared/sequence-viewer/components/AnimationPlayer.svelte").default | null = $state(null);

let playbackController = $state<AnimationPlaybackController | null>(null);
let animPanelState = $state<AnimationPanelState | null>(null);
let isAnimPlaying = $state(false);
let currentAnimStep = $state(0);

let isDownloading = $state(false);
let downloadProgress = $state(0);
```

- [ ] **Step 3: Create EffectsConfigState and wire effect switching**

```typescript
const effectsConfig = createEffectsConfigState();
setEffectsConfigContext(effectsConfig);
```

The `handleEffectChange` function becomes:
```typescript
function handleEffectChange(effect: EffectType) {
  if (effect === selectedEffect) return;
  selectedEffect = effect;
  // EffectsConfigState updates propagate reactively to AnimatorCanvas
  // via the context — AnimatorCanvas reads it each frame.
  // For the QR page, we use a simplified approach: update the
  // trails/fire/etc. toggle in effectsConfig based on selected effect.
  applyEffectToConfig(effect);
}

function applyEffectToConfig(effect: EffectType) {
  const updaters: Record<string, (patch: { enabled: boolean }) => void> = {
    trails: (p) => effectsConfig.updateTrails(p),
    fire: (p) => effectsConfig.updateFire(p),
    led: (p) => effectsConfig.updateLed(p),
    charcoal: (p) => effectsConfig.updateCharcoal(p),
    zap: (p) => effectsConfig.updateZap(p),
    sparkles: (p) => effectsConfig.updateSparkles(p),
    echo: (p) => effectsConfig.updateEcho(p),
    bloom: (p) => effectsConfig.updateBloom(p),
    water: (p) => effectsConfig.updateWater(p),
    bubbles: (p) => effectsConfig.updateBubbles(p),
    petals: (p) => effectsConfig.updatePetals(p),
    smoke: (p) => effectsConfig.updateSmoke(p),
    ink: (p) => effectsConfig.updateInk(p),
    frost: (p) => effectsConfig.updateFrost(p),
    silk: (p) => effectsConfig.updateSilk(p),
    pulse: (p) => effectsConfig.updatePulse(p),
  };
  for (const [key, update] of Object.entries(updaters)) {
    update({ enabled: key === effect });
  }
}
```

- [ ] **Step 4: Remove all MP4 pipeline functions**

Delete entirely:
- `computeHash()`
- `videoUrl()`
- `checkR2Cache()`
- `uploadToR2()`
- `precomputeFrames()`
- `spawnWorker()`
- `togglePlay()`
- `startScrub()`, `handleScrub()`, `endScrub()`
- `wasPlayingBeforeScrub`
- `formatTime()`

Remove the `R2_CDN` and `RENDER_FPS` constants. Keep `BASE_BPM`.

- [ ] **Step 5: Rewrite handleBpmChange to use the playback controller**

```typescript
function handleBpmChange(newBpm: number) {
  selectedBpm = newBpm;
  const speed = newBpm / BASE_BPM;
  playbackController?.setSpeed(speed);
}
```

- [ ] **Step 6: Rewrite handlePropChange — just update reactive props**

```typescript
function handlePropChange(propType: PropType) {
  if (propType === selectedProp) return;
  selectedProp = propType;
  // AnimationPlayer receives bluePropType/redPropType as props.
  // Svelte reactivity handles the rest — texture reload, re-render.
}
```

- [ ] **Step 7: Rewrite handleDownload to use the export flow**

```typescript
async function handleDownload() {
  if (!resolvedSeq || !playbackController || !animPanelState) return;

  const canvasEl = document.querySelector<HTMLCanvasElement>(".animation-player canvas");
  if (!canvasEl) return;

  isDownloading = true;
  downloadProgress = 0;

  try {
    const { getVideoExportOrchestrator } = await import(
      "$lib/shared/animation-engine/getVideoExportOrchestrator"
    );
    const orchestrator = getVideoExportOrchestrator();

    const blob = await orchestrator.executeExport(
      canvasEl,
      playbackController,
      animPanelState,
      (progress) => {
        downloadProgress = progress.progress;
      },
      {
        compositeMode: "none",
        fps: 60,
        loopCount: 2,
        resolution: 720,
        includeAnimationStartPosition: true,
        includeEndHold: true,
      }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${seqWord}.mp4`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("[QR] Download failed:", err);
  } finally {
    isDownloading = false;
    downloadProgress = 0;
  }
}
```

- [ ] **Step 8: Rewrite onMount — resolve shortcode, lazy-load AnimationPlayer**

```typescript
onMount(async () => {
  if (!shortCode) {
    pageState = { kind: "error", message: "No short code provided" };
    return;
  }

  try {
    const [seq_, PlayerModule] = await Promise.all([
      shortCodeManager.resolveShortCode(shortCode),
      getGlyphCache().initialize().then(() =>
        import("$lib/shared/sequence-viewer/components/AnimationPlayer.svelte")
      ),
    ]);

    let seq = seq_;
    if (!seq) {
      pageState = { kind: "error", message: "Sequence not found" };
      return;
    }

    seq = await hydrateSequence(seq, {
      letterDeriver: getLetterDeriver(),
      positionDeriver: getPositionDeriver(),
      loopDetector,
      gridModeDeriver,
    });

    resolvedSeq = seq;
    const word = seq.word || seq.name || "Sequence";
    seqWord = word;
    selectedProp =
      (seq.intendedProp?.bluePropType as PropType) ?? PropType.STAFF;

    AnimationPlayerComponent = PlayerModule.default;

    if (!isInlineEncoded(shortCode) && isGenuineScan(shortCode)) {
      captureEvent("qr_video_scanned", {
        short_code: shortCode,
        sequence_word: word,
        country: data?.geo?.country || null,
      });
    }

    // Apply default effect
    applyEffectToConfig(selectedEffect);

    pageState = { kind: "playing", word };
  } catch (err: unknown) {
    pageState = {
      kind: "error",
      message: err instanceof Error ? err.message : "Failed to load sequence",
    };
  }
});
```

- [ ] **Step 9: Simplify onDestroy**

```typescript
onDestroy(() => {
  // AnimationPlayer handles its own cleanup (controller.dispose, animState.dispose)
});
```

The `onDestroy` can be empty or removed entirely — `AnimationPlayer` manages its own lifecycle.

- [ ] **Step 10: Run typecheck**

Run: `npm run check`
Expected: 0 errors (warnings in unrelated files are OK)

- [ ] **Step 11: Commit script rewrite**

```bash
git add src/routes/q/[code]/+page.svelte
git commit -m "refactor(qr): replace MP4 worker pipeline script with live AnimationPlayer"
```

---

### Task 2: Rewrite `+page.svelte` template — replace `<video>` with AnimationPlayer

**Files:**
- Modify: `src/routes/q/[code]/+page.svelte` (template section)

- [ ] **Step 1: Remove the "rendering" state block**

Delete the entire `{:else if pageState.kind === "rendering"}` block (the progress bar, "Rendering your sequence..." message, "Future scans will load instantly." hint). This state no longer exists.

- [ ] **Step 2: Replace the "playing" state block**

Replace the video-area `<div>` and its contents. Remove the `<video>` element, the `bgRenderPercent` overlay, and the bottom scrubber bar. Replace with:

```svelte
{:else if pageState.kind === "playing" && AnimationPlayerComponent && resolvedSeq}
  <div class="player-layout">
    <div class="word-title">
      <TKAWordGlyph word={rawWord} height={28} darkMode />
    </div>
    <div class="canvas-area">
      <svelte:component
        this={AnimationPlayerComponent}
        sequence={resolvedSeq}
        autoPlay={true}
        showControls={false}
        bluePropType={selectedProp}
        redPropType={selectedProp}
        previewDarkMode={true}
        onControllerReady={(ctrl, state) => {
          playbackController = ctrl;
          animPanelState = state;
        }}
        onStepChange={(stepIndex, playing) => {
          currentAnimStep = stepIndex ?? 0;
          isAnimPlaying = playing;
        }}
      />
    </div>

    <div class="player-controls">
      <div class="tempo-row">
        <TempoControl
          bpm={selectedBpm}
          onBpmChange={handleBpmChange}
          showPresets={false}
          showPractice={false}
          presetsMode="popover"
        />
      </div>

      <div class="button-grid">
        <button
          type="button"
          class="grid-btn"
          onclick={() => (showPropOverlay = true)}
        >
          <img
            src={PROP_SVG_MAP[selectedProp] ?? "/images/props/buttons/staff.svg"}
            alt=""
            class="grid-btn-icon prop-icon"
          />
          <span class="grid-btn-text">
            <span class="grid-btn-label">Prop</span>
            <span class="grid-btn-sub">{selectedPropLabel}</span>
          </span>
          <i class="fa-solid fa-chevron-right grid-btn-chevron"></i>
        </button>

        <button
          type="button"
          class="grid-btn"
          onclick={() => (showEffectOverlay = true)}
        >
          <i
            class="fa-solid {selectedEffectMeta.icon} grid-btn-fa"
            style:color={selectedEffectMeta.color}
          ></i>
          <span class="grid-btn-text">
            <span class="grid-btn-label">Effects</span>
            <span class="grid-btn-sub">{selectedEffectMeta.label}</span>
          </span>
          <i class="fa-solid fa-chevron-right grid-btn-chevron"></i>
        </button>

        <button
          type="button"
          class="grid-btn primary"
          onclick={handleDownload}
          disabled={isDownloading}
        >
          <i class="fa-solid {isDownloading ? 'fa-spinner fa-spin' : 'fa-download'} grid-btn-fa"></i>
          <span class="grid-btn-label">{isDownloading ? `${downloadProgress}%` : 'Download'}</span>
        </button>

        <a href="/browse/gallery" class="grid-btn cta">
          <i class="fa-solid fa-compass grid-btn-fa"></i>
          <span class="grid-btn-label">Open TKA</span>
        </a>
      </div>

      <!-- Desktop sections: keep prop/effect expandable sections and desktop-actions -->
      <!-- (same as current, unchanged — handlePropChange and handleEffectChange are already rewritten) -->
    </div>
  </div>

  <!-- Overlays: keep prop and effect overlay panels unchanged -->
{/if}
```

- [ ] **Step 3: Remove the bottom scrubber bar**

Delete the entire `.bottom-scrubber` `<div>` and its contents. The AnimationPlayer's internal playback controller handles play/pause. The scrubber is no longer needed — the animation loops continuously.

- [ ] **Step 4: Update the `.player-layout` padding**

Remove `padding-bottom: calc(48px + max(6px, env(safe-area-inset-bottom)));` — no bottom scrubber bar to account for.

- [ ] **Step 5: Replace `.video-area` CSS with `.canvas-area` CSS**

```css
.canvas-area {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  max-width: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  overflow: hidden;
  background: #000;
}
```

- [ ] **Step 6: Remove all dead CSS**

Delete CSS for:
- `.sequence-video`
- `.bg-render-overlay`, `.bg-render-bar`, `.bg-render-fill`, `.bg-render-label`
- `.bottom-scrubber`, `.play-btn-sm`, `.scrubber-track`, `.scrubber-fill`, `.scrubber-input`, `.time-display-sm`, `.scrubber-bpm`
- `.progress-container`, `.progress-bar` (rendering state removed)
- `.first-view-message`, `.hint-text` (rendering state removed)

- [ ] **Step 7: Update file header comment**

Replace the comment block at the top with:
```html
<!--
  /q/[code]/+page.svelte

  QR Scan Landing Page

  Minimal page that plays a live 2D Canvas animation of the scanned sequence
  using a lazy-loaded AnimationPlayer component. No worker, no MP4 encoding,
  no R2 caching — the production animation engine renders directly.

  URL format: /q/{shortCode}

  Flow:
  1. Resolve short code → SequenceData
  2. Lazy-load AnimationPlayer + GlyphCache (parallel with step 1)
  3. Mount AnimationPlayer → live 2D playback
-->
```

- [ ] **Step 8: Run typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 9: Commit template rewrite**

```bash
git add src/routes/q/[code]/+page.svelte
git commit -m "refactor(qr): replace video element with live AnimationPlayer canvas"
```

---

### Task 3: Wire EffectsConfigState to AnimationPlayer

**Files:**
- Modify: `src/routes/q/[code]/+page.svelte`

The QR page creates its own `EffectsConfigState` in Task 1 Step 3 and sets context. `AnimatorCanvas` reads from context via `getEffectsConfigContext()` (line 288 of AnimatorCanvas.svelte). This task validates the wiring works.

- [ ] **Step 1: Verify effects context is set before AnimationPlayer mounts**

`createEffectsConfigState()` and `setEffectsConfigContext()` run at component init (script top-level), which executes before `onMount` and before any child components mount. This guarantees `AnimatorCanvas` will find the context. Confirm by reading the component initialization order.

- [ ] **Step 2: Verify `applyEffectToConfig` works for all 16 effects + "none"**

The `applyEffectToConfig` function from Task 1 Step 3 must handle:
- `"none"` — disables all effects
- Each of the 16 effect types — enables that one, disables all others

Verify the `EffectsConfigState` update method naming convention. Read `effects-config-state.svelte.ts` to confirm update methods follow the pattern `update{EffectName}(patch)` where the patch accepts `{ enabled: boolean }`.

The actual method names in `EffectsConfigState`:
```
updateTrails, updateFire, updateLed, updateCharcoal, updateZap,
updateSparkles, updateEcho, updateBloom, updateWater, updateBubbles,
updatePetals, updateSmoke, updateInk, updateFrost, updateSilk, updatePulse
```

Each accepts a partial intent: `{ enabled?: boolean, ... }`.

- [ ] **Step 3: Test effect switching visually**

Open `http://localhost:5173/q/{validShortCode}` in the browser. Select different effects from the overlay. Verify:
- Trails render correctly (default)
- Fire/Bloom/Sparkles/etc. render when selected
- "None" disables all effects
- Effect switching is instantaneous (no re-render delay)

- [ ] **Step 4: Commit**

```bash
git add src/routes/q/[code]/+page.svelte
git commit -m "feat(qr): wire effects config state for live effect switching"
```

---

### Task 4: Wire download button to VideoExportOrchestrator

**Files:**
- Modify: `src/routes/q/[code]/+page.svelte`

The `handleDownload` function from Task 1 Step 7 lazy-loads and calls `getVideoExportOrchestrator`. This task validates the export flow works on the QR page.

- [ ] **Step 1: Verify the VideoExportOrchestrator factory is registered at app startup**

The factory is registered in `src/lib/shared/composition-root/deferred-registrations.ts` during app bootstrap. The QR page loads as a SvelteKit route, so this registration runs before any page component mounts. Verify:

```bash
grep -n "registerVideoExportOrchestratorFactory" src/lib/shared/composition-root/deferred-registrations.ts
```

If the registration is gated behind a feature flag or lazy-loaded module that the QR page doesn't trigger, the factory will throw "not registered." In that case, the download button must lazy-load the full orchestrator differently — by importing `VideoExportOrchestrator` directly from `src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts`.

- [ ] **Step 2: Handle the "factory not registered" case**

The QR page is a minimal route that may not load the full composition root. Add a fallback:

```typescript
async function handleDownload() {
  if (!resolvedSeq || !playbackController || !animPanelState) return;

  const canvasEl = document.querySelector<HTMLCanvasElement>(".canvas-area canvas");
  if (!canvasEl) return;

  isDownloading = true;
  downloadProgress = 0;

  try {
    let orchestrator;
    try {
      const { getVideoExportOrchestrator } = await import(
        "$lib/shared/animation-engine/getVideoExportOrchestrator"
      );
      orchestrator = getVideoExportOrchestrator();
    } catch {
      // Factory not registered — import directly
      const { VideoExportOrchestrator } = await import(
        "$lib/features/compose/services/implementations/VideoExportOrchestrator"
      );
      orchestrator = new VideoExportOrchestrator();
    }

    const blob = await orchestrator.executeExport(
      canvasEl,
      playbackController,
      animPanelState,
      (progress) => {
        downloadProgress = Math.round(progress.progress);
      },
      {
        compositeMode: "none",
        fps: 60,
        loopCount: 2,
        resolution: 720,
        includeAnimationStartPosition: true,
        includeEndHold: true,
      }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${seqWord}.mp4`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("[QR] Download failed:", err);
  } finally {
    isDownloading = false;
    downloadProgress = 0;
  }
}
```

- [ ] **Step 3: Test download in browser**

Open `http://localhost:5173/q/{validShortCode}`. Tap Download. Verify:
- Progress percentage updates in the button
- An MP4 file downloads with the sequence word as filename
- The animation continues playing during export (not blocked)
- After download, button resets to "Download"

- [ ] **Step 4: Commit**

```bash
git add src/routes/q/[code]/+page.svelte
git commit -m "feat(qr): wire download to VideoExportOrchestrator with factory fallback"
```

---

### Task 5: Update responsive layout CSS for canvas-based player

**Files:**
- Modify: `src/routes/q/[code]/+page.svelte` (style section)

The layout changes slightly because: (a) no bottom scrubber bar, (b) canvas replaces video with different aspect ratio handling, (c) AnimationPlayer has its own internal padding.

- [ ] **Step 1: Update player-layout padding (remove scrubber accommodation)**

```css
.player-layout {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 8px;
  gap: 6px;
  overflow: hidden;
}
```

Remove all `padding-bottom: calc(48px + ...)` from base and media queries.

- [ ] **Step 2: Update landscape media query**

In `@media (orientation: landscape), (min-aspect-ratio: 5/4)`:
- Remove `.scrubber-bpm` rule
- Update `.player-layout` to remove scrubber-bottom padding

- [ ] **Step 3: Update desktop media queries**

In `@media (min-width: 960px)`:
- Remove `.bottom-scrubber` centering rules
- Remove `.scrubber-bpm` rule
- Update `.player-layout` padding to remove scrubber bottom

In `@media (min-width: 1440px)`:
- Remove `.bottom-scrubber` max-width rule

- [ ] **Step 4: Run typecheck + verify layout**

Run: `npm run check`
Expected: 0 errors

Test in browser at multiple viewport sizes: mobile portrait, mobile landscape, tablet, desktop.

- [ ] **Step 5: Commit**

```bash
git add src/routes/q/[code]/+page.svelte
git commit -m "style(qr): clean up responsive layout for canvas player"
```

---

### Task 6: Clean up dead imports from QR page

**Files:**
- Modify: `src/routes/q/[code]/+page.svelte`

After all prior tasks, verify no dead imports remain.

- [ ] **Step 1: Audit imports against usage**

Grep each import symbol against the rest of the file. Remove any that are unused:
- `encodeSequence` — removed if `computeHash` was deleted
- `HeadlessAnimationOrchestrator` — removed
- `buildTimelineParams`, `calculateFrameTiming` — removed
- `WorkerOutMessage`, `RenderRequest`, `PrecomputedFrame`, `TransferableAssets` — removed
- `loadAssets`, `loadLetterGlyphs`, `LoadedAssets` — removed
- `getLetterImagePath` — removed
- `Letter` — removed
- `PublicSequencesLoader` — keep (used by `stubBrowseLoader` which is used by `ShortCodeManager`)

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds. Verify the QR page chunk does NOT contain Three.js or 3D code in the dependency chain.

- [ ] **Step 4: Commit**

```bash
git add src/routes/q/[code]/+page.svelte
git commit -m "chore(qr): remove dead MP4 pipeline imports"
```

---

### Task 7: Final verification

**Files:**
- Read-only verification of `src/routes/q/[code]/+page.svelte`

- [ ] **Step 1: Verify success criteria from spec**

1. **QR scan → animation playing in < 3 seconds on 4G:** Measure with DevTools network throttling set to "Fast 3G" or "4G". The lazy-loaded JS chunk + SVG assets should total ~150-230KB gzipped (browser-cacheable). First paint should occur within 3 seconds.

2. **Prop switching is instantaneous:** Change props in the overlay. Verify no loading state, no render delay. The canvas updates on the next frame.

3. **Effects match what users see in the main app:** Compare trails/fire/bloom rendering between the QR page and the sequence viewer. They should be identical — same engine, same renderer.

4. **Download produces an MP4 with correct effects:** Download with different effects selected. Play the MP4 and confirm effects render correctly.

5. **No Three.js or 3D code in the dependency chain:** Check the build output for the QR page chunk. Run:
   ```bash
   npm run build 2>&1 | grep -i "three\|threlte" || echo "No 3D deps found"
   ```
   Or inspect `.svelte-kit/output/client` for the QR page's JS chunk and verify no three.js imports.

- [ ] **Step 2: Verify the spec's "What Gets Removed" table**

| Item | Status |
|---|---|
| `HeadlessAnimationOrchestrator` usage in QR page | Removed |
| `precomputeFrames()` function | Removed |
| Worker spawn logic (`spawnWorker()`) | Removed |
| `headless-video-renderer.worker.ts` import | Removed |
| `WorkerAssetLoader.ts` imports | Removed |
| R2 cache check (`checkR2Cache`, `computeHash`, `videoUrl`) | Removed |
| R2 upload (`uploadToR2`) | Removed |
| `<video>` element + video playback state | Removed |
| `bgRenderPercent`/`bgRenderPhase` | Removed |
| `/api/qr-video/[hash]/+server.ts` | Kept (per spec) |

- [ ] **Step 3: Verify the spec's "What Stays" table**

| Item | Status |
|---|---|
| Shortcode resolution + hydration | Kept |
| GlyphCache initialization | Kept |
| TKAWordGlyph word title | Kept |
| Tempo control component | Kept |
| Prop picker overlay | Kept |
| Effect picker overlay | Kept |
| Download button (re-wired to export flow) | Kept, re-wired |
| Analytics capture | Kept |
| OG meta tags | Kept |
| Error state handling | Kept |

- [ ] **Step 4: Final commit with verification evidence**

```bash
git add -A
git commit -m "feat(qr): live 2D animation replaces MP4 worker pipeline

Closes the QR live animation spec. AnimationPlayer lazy-loads after
shortcode resolution. Prop/effect switching is instantaneous. Download
uses VideoExportOrchestrator. No Three.js in the dependency chain."
```
