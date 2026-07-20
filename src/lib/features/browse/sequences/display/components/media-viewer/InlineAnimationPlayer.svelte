<!--
  InlineAnimationPlayer.svelte

  Lightweight animation player for inline use in gallery detail panels.
  Does not require Create module context - fully standalone.

  Uses the shared animation engine with BPM preset controls.
-->
<script lang="ts">

  import { onMount, onDestroy, untrack } from "svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import BpmChips from "$lib/shared/animation-engine/components/controls/BpmChips.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { TrailSettings } from "$lib/shared/animation-engine/domain/types/trail-types";
  import type { TipEffectMap, TipEffortMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
  import type { SequenceRepository } from "$lib/shared/create/services/sequence-repository";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { getSequenceRepository } from "$lib/shared/create/get-sequence-repository";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { Letter } from "$lib/shared/foundation/domain/models/letter";

  // Per-instance playback stack imports (avoid shared singleton)
  import { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
  import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
  import { AnimationStateManager } from "$lib/shared/animation-engine/services/animation-state-manager";
  import { AnimationLoop } from "$lib/shared/animation-engine/services/animation-loop";

  // BPM/Speed conversion constant
  const DEFAULT_BPM = 60;

  /**
   * Get the Greek letter (α, β, γ) for the start position phase.
   * Uses the sequence prop which has startingPositionGroup preserved.
   */
  function getStartPositionLetter(): Letter | null {
    // Use sequence prop - it has startingPositionGroup preserved
    // (animationState.sequenceData loses this field during processing)
    const seq = sequence;
    if (!seq) return null;

    // 1. Derive from startingPositionGroup (most reliable)
    if (seq.startingPositionGroup) {
      const group = seq.startingPositionGroup.toLowerCase();
      if (group === "alpha") return Letter.ALPHA;
      if (group === "beta") return Letter.BETA;
      if (group === "gamma") return Letter.GAMMA;
    }

    // 2. Check if startPosition.letter is already a valid Greek letter
    const spLetter = seq.startPosition?.letter;
    if (
      spLetter === Letter.ALPHA ||
      spLetter === Letter.BETA ||
      spLetter === Letter.GAMMA
    ) {
      return spLetter;
    }

    // 3. Derive from first beat's startPosition field (GridPosition like "alpha1")
    const firstStep = seq.steps?.[0];
    if (firstStep) {
      const startPos = firstStep.startPosition || (firstStep as any).startPos;
      if (startPos && typeof startPos === "string") {
        const posLower = startPos.toLowerCase();
        if (posLower.startsWith("alpha")) return Letter.ALPHA;
        if (posLower.startsWith("beta")) return Letter.BETA;
        if (posLower.startsWith("gamma")) return Letter.GAMMA;
      }
    }

    return null;
  }

  /**
   * Greek letter (α, β, γ) for the FINAL held position — mirror of
   * getStartPositionLetter for the end-hold phase. At the End the hand isn't
   * mid-letter; it holds the last step's end position, so the glyph should read
   * that position, not the previous step's letter.
   */
  function getEndPositionLetter(): Letter | null {
    const steps = sequence?.steps;
    const lastStep = steps?.[steps.length - 1];
    const endPos = lastStep?.endPosition || (lastStep as any)?.endPos;
    if (endPos && typeof endPos === "string") {
      const posLower = endPos.toLowerCase();
      if (posLower.startsWith("alpha")) return Letter.ALPHA;
      if (posLower.startsWith("beta")) return Letter.BETA;
      if (posLower.startsWith("gamma")) return Letter.GAMMA;
    }
    return null;
  }

  let {
    sequence,
    autoPlay = true,
    showControls = true,
    bluePropType = null,
    redPropType = null,
    externalBpm = null,
    chrome = "full",
    fill = false,
    showPositionGlyph = false,
    onStepChange = undefined,
    scrubbable = false,
    singlePlay = false,
    beatIndicators = true,
    onLoopComplete = undefined,
    trailSettingsOverride = null,
    tipEffectMap = undefined,
    tipEffortMap = undefined,
    backgroundAlpha = 1,
    hideTkaGlyph = false,
    hideStepNumbers = false,
    gridVisible = true,
    disableContextMenu = false,
  }: {
    sequence: SequenceData;
    autoPlay?: boolean;
    showControls?: boolean;
    bluePropType?: string | null;
    redPropType?: string | null;
    /** When provided, overrides internal BPM and controls playback speed externally */
    externalBpm?: number | null;
    /**
     * Reports the live 1-based fractional playback step (`currentStep`) to an
     * external consumer on every frame it changes. Used by the guide reader to
     * ring the matching on-screen strip cell in time with the animation; other
     * hosts (gallery, Arena) omit it and pay no per-frame cost.
     */
    onStepChange?: (currentStep: number) => void;
    /**
     * "full" (default) = external play button + BpmChips grid + the in-canvas
     * UnifiedTimeline scrubber (gallery detail, Arena).
     * "minimal" = tap-to-play canvas + the thin export-style progress line +
     * a mouse hover badge, no transport chrome — the embedded/showcase idiom
     * (feedback_minimal_player_chrome). Drive tempo externally via `externalBpm`.
     */
    chrome?: "full" | "minimal";
    /**
     * Show the α/β/γ start→end position indicator centered at the top of the
     * canvas. Educational overlay the guide turns on for hand-path exploration;
     * off by default so gallery/Arena embeds are unaffected.
     */
    showPositionGlyph?: boolean;
    /**
     * Maximize the canvas: fill the whole container instead of reserving
     * vertical overhead for a header + progress pill. Minimal chrome hides both
     * (header off, thin progress LINE not the pill), so that reserved 8.5rem
     * otherwise shrinks the square for nothing. Opt-in so other minimal hosts
     * (gallery/showcase) keep their current sizing; the guide companion sets it
     * to make the animation as large as possible in the panel.
     */
    fill?: boolean;
    /**
     * Upgrade the minimal-chrome progress LINE into a seekable scrubber (drag/
     * click/keyboard to seek). Scrubbing pauses playback; releasing resumes it
     * only if it was already playing (SequenceProgressBar's onScrubStart/
     * onScrubEnd contract). Off by default — existing minimal-chrome callers
     * (gallery/Arena embeds) keep the display-only line. Spec:
     * docs/superpowers/specs/2026-07-17-scrubbable-guide-showcases-design.md.
     */
    scrubbable?: boolean;
    /**
     * Play through once, then rest on the end pose instead of looping. Tapping
     * the canvas (or the hover badge) while resting on the end replays from the
     * start. Off by default so every existing looping caller is byte-identical.
     */
    singlePlay?: boolean;
    /**
     * Show the canvas's Start/End text overlay (GlyphOverlay's isAtStartPosition/
     * isAtEndPosition indicator). On by default (unchanged for every existing
     * caller); the guide showcase turns it off — the on-screen strip already
     * labels "Start"/steps, so the canvas overlay is redundant there.
     */
    beatIndicators?: boolean;
    /**
     * Fires every time the loop wraps back to its start (not just once at
     * the end — a seamlessly-loopable sequence never truly "ends"). The
     * homepage hero attract act uses this boundary to decide when to swap
     * in the next sequence/prop; other hosts (gallery, Arena) omit it.
     */
    onLoopComplete?: () => void;
    /**
     * Overrides the trail settings passed to the canvas. Null (default)
     * keeps today's behavior for every existing caller: the global
     * `animationSettings.trail` singleton. Set this instead of mutating
     * that singleton directly — the hero's vivid preset must not leak into
     * the in-app Compose panel, which reads the same singleton.
     */
    trailSettingsOverride?: TrailSettings | null;
    /**
     * Canvas background opacity, forwarded to AnimatorCanvas. At 0 the
     * engine requests an alpha context and CanvasSurface goes fully
     * transparent, so the host's own backdrop shows through — the
     * shape-matrix drill uses this to keep its mandala layer visible
     * underneath the props (same mechanism as the practice mirror).
     */
    backgroundAlpha?: number;
    /**
     * Per-tip effect assignments forwarded to the canvas. Without at least
     * one "trails" entry the render loop's hasTrailTips gate keeps
     * effectiveTrailsVisible false, so NO trails draw regardless of trail
     * settings — this player historically never passed one, which is why
     * inline surfaces showed no trails. The hero passes a cell-wide trails
     * map; hosts that omit it keep today's trail-less behavior.
     */
    tipEffectMap?: TipEffectMap;
    /** Per-instance effort (easing) overrides. Without this the canvas falls
     *  back to the global visibility manager's persisted effortPreset, so a
     *  visitor's (or Austen's) in-app easing choice leaks into public embeds.
     *  Cell-wide linear: `{ "*": { effort: "linear" } }`. */
    tipEffortMap?: TipEffortMap;
    /** Hide the in-canvas letter glyph / step counter (chrome-free embeds
     *  like the caps live hero — "a prop floating in space"). */
    hideTkaGlyph?: boolean;
    hideStepNumbers?: boolean;
    /** Hide the diamond/box grid — pattern-trace embeds show only the prop. */
    gridVisible?: boolean;
    /** Suppress the canvas right-click / long-press settings menu so a locked
     *  public embed can't have its prop/effort/BPM changed out from under it. */
    disableContextMenu?: boolean;
  } = $props();

  const minimal = $derived(chrome === "minimal");

  // Services - per-instance to allow multiple simultaneous players (e.g., Arena)
  let sequenceService: SequenceRepository | null = null;
  let playbackController: AnimationPlaybackController | null = null;
  let servicesReady = $state(false);
  let loading = $state(true);
  // Once true, reloads never return to the loading-state branch — see the
  // template comment (unmounting the canvas there kills the engine mid-swap).
  let hasLoadedOnce = $state(false);
  let error = $state<string | null>(null);

  // Animation state - each player gets its own
  const animationState = createAnimationPanelState();

  // Track last loaded sequence to prevent re-loading same sequence
  // Also prevents remounts during prop type changes (hot-swap handles those)
  let lastLoadedSequenceId: string | null = null;

  // Local reactive state for UI
  let isPlaying = $state(false);
  let bpm = $state(DEFAULT_BPM); // 60 BPM = 1.0x speed

  // Sync playing state from animation state
  $effect(() => {
    const checkPlaying = () => {
      const current = animationState.isPlaying;
      if (current !== isPlaying) {
        isPlaying = current;
      }
    };
    checkPlaying();
    const interval = setInterval(checkPlaying, 50);
    return () => clearInterval(interval);
  });

  // Derived state for canvas
  // Letters are a PROP-only glyph — a hand pictograph never shows one (a hand has
  // no thumb/pinky reference to letter). When this player renders hands, suppress
  // the letter overlay entirely (start-position Greek letter + per-step letter).
  // Prop/staff renders (gallery, Arena) pass a non-hand type → unchanged.
  const isHandRender = $derived(
    (bluePropType ?? "").toLowerCase() === "hand" || (redPropType ?? "").toLowerCase() === "hand"
  );

  let currentLetter = $derived.by(() => {
    if (isHandRender) return null;
    if (!animationState.sequenceData) return null;
    const currentStep = animationState.currentStep;

    // At start position phase (before beat 1) - show Greek letter (α, β, γ)
    if (currentStep < 1) {
      return getStartPositionLetter();
    }

    // At the end-hold (freeform sequences pause on the final position before
    // looping) - show the held position's Greek letter, not the last step's
    // letter. Loopable sequences wrap before reaching here so this stays inert.
    const stepCount = animationState.sequenceData.steps?.length ?? 0;
    if (stepCount > 0 && currentStep >= stepCount + 0.99) {
      return getEndPositionLetter();
    }

    if (animationState.sequenceData.steps?.length > 0) {
      // currentStep is 1-based: currentStep 1.0-2.0 = beat 1 (uses steps[0])
      const stepIndex = Math.max(0, Math.floor(currentStep) - 1);
      const clampedIndex = Math.min(
        stepIndex,
        animationState.sequenceData.steps.length - 1
      );
      return animationState.sequenceData.steps[clampedIndex]?.letter || null;
    }

    return null;
  });

  let currentStepData = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const currentStep = animationState.currentStep;

    if (currentStep < 1 && animationState.sequenceData.startPosition) {
      return animationState.sequenceData.startPosition;
    }

    if (animationState.sequenceData.steps?.length > 0) {
      // currentStep is 1-based: currentStep 1.0-2.0 = beat 1 (uses steps[0])
      const stepIndex = Math.max(0, Math.floor(currentStep) - 1);
      const clampedIndex = Math.min(
        stepIndex,
        animationState.sequenceData.steps.length - 1
      );
      return animationState.sequenceData.steps[clampedIndex] || null;
    }

    return null;
  });

  // Prefer sequence prop's gridMode (always current) over animation state (may be stale during switch)
  let gridMode = $derived(
    sequence?.gridMode ?? animationState.sequenceData?.gridMode
  );

  // Load services on mount - create per-instance playback stack so multiple
  // InlineAnimationPlayers can run simultaneously (e.g., Arena side-by-side)
  onMount(async () => {
    try {
      sequenceService = getSequenceRepository();

      // Stateful services - fresh instance per player
      const stateManager = new AnimationStateManager();
      const loop = new AnimationLoop();
      const orchestrator = new SequenceAnimationOrchestrator(
        stateManager
      );
      playbackController = new AnimationPlaybackController(
        orchestrator,
        loop
      );
      playbackController.onLoopComplete(() => onLoopComplete?.());

      servicesReady = true;
    } catch (err) {
      console.error("Failed to initialize animation player:", err);
      error = "Failed to load animation";
      loading = false;
    }
  });

  onDestroy(() => {
    playbackController?.offLoopComplete();
    playbackController?.dispose();
    animationState.dispose();
  });

  // Sync external BPM to playback speed when provided.
  //
  // untrack() the imperative push: setSpeed() reads reactive playback state and
  // fans its change out to every registered visibility-manager observer. Left
  // tracked, those reads become dependencies of THIS effect, so its own side
  // effect re-triggers it — an unbounded loop that trips
  // effect_update_depth_exceeded on hosts with many pictograph observers mounted
  // (the guide reader stacks 100+). The effect must react to externalBpm ALONE.
  $effect(() => {
    if (externalBpm !== null && playbackController) {
      const speed = externalBpm / DEFAULT_BPM;
      const pc = playbackController;
      untrack(() => {
        pc.setSpeed(speed);
        bpm = externalBpm;
      });
    }
  });

  // Report the live playback step to an external consumer (the guide reader
  // rings the matching on-screen strip cell in sync). Read `onStepChange` first
  // so hosts that omit it never take a dependency on currentStep — no per-frame
  // effect for gallery/Arena. untrack the callback so a consumer that writes
  // state (the reader mutates its active-step signal) can't feed back into and
  // re-trigger this effect (the same footgun the externalBpm effect avoids).
  $effect(() => {
    const cb = onStepChange;
    if (!cb) return;
    const step = animationState.currentStep;
    untrack(() => cb(step));
  });

  // Autoplay: fires at most once per successfully-loaded sequence, whenever
  // `autoPlay` is true. Reactive to the PROP (not just read once at load time)
  // so a caller whose `autoPlay` starts false and flips true later — the guide
  // showcase, which waits for its first scroll-into-view before playing — gets
  // its one autoplay exactly when that happens. Existing static `autoPlay={true}`
  // callers (gallery, Arena) behave identically to before: this fires once, at
  // load, after the same 300ms settle delay the old inline call used.
  let autoPlayedForLoadId: string | null = null;
  $effect(() => {
    // Guard order is load-bearing: `servicesReady` and `sequenceData` are
    // REACTIVE and must be read before the plain (non-$state)
    // `playbackController` variable. Short-circuiting on the plain variable
    // first leaves this effect with no reactive dependency that changes when
    // the async load completes, so an `autoPlay` that was already true (the
    // showcase scrolled into view before load finished) would arm once, miss,
    // and never retry.
    if (!autoPlay || !servicesReady || !animationState.sequenceData) return;
    if (!playbackController) return;
    const loadId = lastLoadedSequenceId;
    if (autoPlayedForLoadId === loadId) return;
    if (animationState.isPlaying) {
      autoPlayedForLoadId = loadId;
      return;
    }
    autoPlayedForLoadId = loadId;
    const pc = playbackController;
    setTimeout(() => {
      untrack(() => {
        if (pc === playbackController) pc.togglePlayback();
      });
    }, 300);
  });

  // Watch for sequence changes and reload animation
  // Only triggers when sequence ID changes, not on every state update
  $effect(() => {
    const sequenceId = sequence?.id || sequence?.word || sequence?.name;

    if (sequence && servicesReady && sequenceId !== lastLoadedSequenceId) {
      // Use untrack to avoid creating dependency on isPlaying
      untrack(() => {
        // Stop any currently playing animation
        if (animationState.isPlaying) {
          playbackController?.togglePlayback();
        }
        // Reset state and reload
        animationState.reset();
        lastLoadedSequenceId = sequenceId ?? null;
        loadAnimation();
      });
    }
  });

  async function loadAnimation() {
    if (!sequenceService || !playbackController || !sequence) return;

    loading = true;
    error = null;

    try {
      // Load full sequence data if needed
      const fullSequence = await loadSequenceData(sequence);

      if (!fullSequence) {
        throw new Error("Failed to load sequence data");
      }

      // Initialize playback. singlePlay reverses the loop flag: rest on the
      // end pose instead of looping (the `shouldLoop` seam the controller
      // already implements — see animation-playback-controller.ts's
      // shouldLoop branches in onAnimationUpdate/runStepPlaybackTick).
      animationState.setShouldLoop(!singlePlay);
      const success = playbackController.initialize(
        fullSequence,
        animationState
      );

      if (!success) {
        throw new Error("Failed to initialize playback");
      }

      // Note: playbackController.initialize() already sets normalized sequence data on the state
      // Autoplay is handled by the reactive $effect above (fires once per load).
      hasLoadedOnce = true;
    } catch (err) {
      console.error("Failed to load animation:", err);
      error = err instanceof Error ? err.message : "Failed to load animation";
    } finally {
      loading = false;
    }
  }

  async function loadSequenceData(
    seq: SequenceData
  ): Promise<SequenceData | null> {
    if (!sequenceService) return null;

    const hasMotionData = (s: SequenceData) =>
      Array.isArray(s.steps) &&
      s.steps.length > 0 &&
      s.steps.some((step) => step?.motions?.blue && step?.motions?.red);

    if (hasMotionData(seq)) {
      return seq;
    }

    // Try to load from gallery
    const identifier = seq.word || seq.name || seq.id;
    if (identifier) {
      const loaded = await sequenceService.getSequence(identifier);
      if (loaded && hasMotionData(loaded)) {
        return loaded;
      }
    }

    return seq;
  }

  // Single-play "ended" check: past the final beat's motion (mirrors the
  // currentLetter/getEndPositionLetter end-hold check above).
  function isAtEnd(): boolean {
    const stepCount = animationState.sequenceData?.steps?.length ?? 0;
    return stepCount > 0 && animationState.currentStep >= stepCount + 0.99;
  }

  function togglePlayback() {
    if (!playbackController) return;
    // Single-play rests on the end pose instead of looping — tapping/hover-
    // badge "play" from there must replay from the start, not silently no-op
    // (togglePlayback() alone would start the loop already-at-end and stop it
    // again on the very next tick). Gated to singlePlay so every looping
    // caller (shouldLoop=true) keeps today's exact resume-from-pause behavior.
    if (singlePlay && !animationState.isPlaying && isAtEnd()) {
      playbackController.stop();
    }
    playbackController.togglePlayback();
  }

  function handleBpmChange(newBpm: number) {
    bpm = newBpm;
    const speed = newBpm / DEFAULT_BPM;
    playbackController?.setSpeed(speed);
  }

  // ── Scrub (seekable progress line) ──────────────────────────────────────
  // SequenceProgressBar's onSeek reports a 0..1 ratio; AnimatorCanvas's own
  // playbackAdapter (created internally from currentStep/steps) converts that
  // ratio into a target STEP number before calling onProgressBarSeek — so this
  // handler receives a step, not a ratio. seekToStep() is the exact seam
  // UnifiedTimeline's own scrubber uses (mixes in the current fraction for an
  // integer beat, honors an exact fraction otherwise) and keeps the loop
  // running if it was already running.
  let wasPlayingBeforeScrub = false;
  function handleScrubStart() {
    wasPlayingBeforeScrub = animationState.isPlaying;
    if (wasPlayingBeforeScrub) playbackController?.togglePlayback();
  }
  function handleScrubEnd() {
    if (wasPlayingBeforeScrub) playbackController?.togglePlayback();
    wasPlayingBeforeScrub = false;
  }
  function handleSeek(targetStep: number) {
    playbackController?.seekToStep(targetStep);
  }
</script>

<div class="inline-animation-player">
  {#if loading && !hasLoadedOnce}
    <!-- First load only. On RELOADS (sequence prop swap) this branch must NOT
         fire: flipping to it unmounts AnimatorCanvas, which destroys the whole
         engine — a fresh engine treats the prop-type override as a first-time
         assignment, so the morph crossfade is suppressed and the swap pops.
         Keeping the canvas mounted through reloads is what makes the in-place
         sequence swap (and the hero act's prop morph) actually seamless. -->
    <div class="loading-state">
      <ProgressRing percent={-1} size={24} strokeWidth={3} />
      <span>Loading animation...</span>
    </div>
  {:else if error}
    <div class="error-state">
      <span>{error}</span>
      <button class="retry-btn" onclick={() => loadAnimation()}>Retry</button>
    </div>
  {:else}
    <!-- Animation Canvas -->
    <div class="canvas-container">
      <AnimatorCanvas
        blueProp={animationState.bluePropState}
        redProp={animationState.redPropState}
        {gridVisible}
        {disableContextMenu}
        {gridMode}
        letter={currentLetter}
        stepData={currentStepData}
        sequenceData={animationState.sequenceData}
        currentStep={animationState.currentStep}
        {isPlaying}
        onPlaybackToggle={togglePlayback}
        trailSettings={trailSettingsOverride ?? animationSettings.trail}
        {backgroundAlpha}
        {tipEffectMap}
        {tipEffortMap}
        {bluePropType}
        {redPropType}
        positionGlyphVisible={showPositionGlyph}
        tapToToggle={minimal}
        progressLine={minimal}
        hoverHint={minimal ? "badge" : "none"}
        fillContainer={fill}
        {hideTkaGlyph}
        {hideStepNumbers}
        hideHeader={fill}
        hideProgressBar={fill && !scrubbable}
        onProgressBarSeek={scrubbable ? handleSeek : null}
        onProgressBarScrubStart={scrubbable ? handleScrubStart : null}
        onProgressBarScrubEnd={scrubbable ? handleScrubEnd : null}
        {beatIndicators}
      />
    </div>

    <!-- Controls (full chrome only — minimal uses tap-to-play + progress line) -->
    {#if showControls && !minimal}
      <div class="controls">
        <button
          class="control-btn play-btn"
          onclick={togglePlayback}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {#if isPlaying}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          {/if}
        </button>

        <div class="bpm-controls">
          <BpmChips {bpm} variant="compact" onBpmChange={handleBpmChange} />
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .inline-animation-player {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    gap: 8px;
  }

  .canvas-container {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    overflow: hidden;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
  }

  .control-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 50%;
    color: var(--theme-text);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    flex-shrink: 0;
  }

  .control-btn svg {
    width: 20px;
    height: 20px;
  }

  .control-btn:hover {
    background: var(--theme-card-hover-bg);
  }

  .control-btn:active {
    transform: scale(0.95);
  }

  .play-btn {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: linear-gradient(
      135deg,
      var(--semantic-info) 0%,
      color-mix(in srgb, var(--semantic-info) 80%, black) 100%
    );
    border-color: transparent;
  }

  .play-btn:hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-info) 80%, black) 0%,
      color-mix(in srgb, var(--semantic-info) 65%, black) 100%
    );
  }

  .bpm-controls {
    flex: 1;
    min-width: 0;
  }

  /* ===========================================
     WIDE LANDSCAPE LAYOUT (e.g., unfolded Z-Fold)
     Switch to side-by-side: canvas left, controls right
     =========================================== */
  @media (orientation: landscape) and (min-width: 600px) and (min-height: 400px) {
    .inline-animation-player {
      flex-direction: row;
      gap: 12px;
    }

    .canvas-container {
      flex: 1;
      min-width: 0;
      border-radius: 12px;
    }

    .controls {
      flex-direction: column;
      width: 140px;
      flex-shrink: 0;
      padding: 12px;
      border-radius: 12px;
      gap: 12px;
      justify-content: flex-start;
      align-items: stretch;
    }

    .control-btn.play-btn {
      width: 100%;
      height: var(--min-touch-target);
      border-radius: 10px;
    }

    .bpm-controls {
      flex: none;
      width: 100%;
    }

    /* Stack BPM chips vertically in sidebar */
    .bpm-controls :global(.bpm-chips.compact) {
      flex-wrap: wrap;
      gap: 6px;
    }

    .bpm-controls :global(.preset-chip) {
      flex: 1 1 calc(50% - 3px);
      min-width: 0;
      padding: 10px 4px;
    }

    /* Custom chip takes full width at bottom */
    .bpm-controls :global(.custom-chip) {
      flex: 1 1 100%;
      max-width: none;
    }
  }

  /* Extra wide screens (like tablets or larger foldables) - give controls more room */
  @media (orientation: landscape) and (min-width: 900px) and (min-height: 500px) {
    .controls {
      width: 160px;
    }
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px;
    height: 100%;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .error-state {
    color: color-mix(in srgb, var(--semantic-error) 50%, white);
  }

  .retry-btn {
    padding: 8px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: var(--theme-text);
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .retry-btn:hover {
    background: var(--theme-card-hover-bg);
  }

  /* Reduce motion */
  @media (prefers-reduced-motion: reduce) {
    .control-btn,
    .retry-btn {
      transition: none;
    }
  }
</style>
