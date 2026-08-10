<!--
	CardHoverPreviewLayer.svelte

	Plays a gallery card's sequence in place, filling the card's thumbnail box,
	with the engine-aligned mandala guide drawn beneath the props.

	It renders inside the card rather than popping forward, so it can never
	cover a neighbour, never needs viewport clamping, and never changes the
	grid's geometry — the card looks the same size whether it's animating or
	not. The word header rides above the canvas because the static thumbnail
	underneath (which bakes the word in) is hidden while this is up.

	Mounted only while its card is the single active preview, so exactly one
	AnimationEngine exists at a time no matter how big the grid is.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
  import { AnimationStateManager } from "$lib/shared/animation-engine/services/animation-state-manager";
  import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { ensureMotionData } from "$lib/shared/sequence-viewer/services/sequence-motion-loader";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  const { sequence }: { sequence: SequenceData } = $props();

  const BPM = 60;
  const MS_PER_BEAT = 60000 / BPM;

  interface Playback {
    sequence: SequenceData;
    orchestrator: SequenceAnimationOrchestrator;
    animState: ReturnType<typeof createAnimationPanelState>;
    visibility: AnimationVisibilityStateManager;
  }

  let playback = $state<Playback | null>(null);
  let currentStep = $state(0);
  let frameId: number | null = null;
  let startTime: number | null = null;
  /** Guards against a slow hydration landing after the pointer moved on. */
  let loadToken = 0;

  function teardown() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    startTime = null;
    currentStep = 0;
    playback?.orchestrator.dispose();
    playback?.animState.dispose();
    playback = null;
  }

  function tick(now: number) {
    if (startTime === null) startTime = now;
    currentStep = (now - startTime) / MS_PER_BEAT;
    frameId = requestAnimationFrame(tick);
  }

  async function start(target: SequenceData) {
    const token = ++loadToken;
    const hydrated = await ensureMotionData(target);
    if (token !== loadToken) return;
    if (!hydrated?.steps?.length) return;

    const orchestrator = new SequenceAnimationOrchestrator(new AnimationStateManager());
    const animState = createAnimationPanelState();
    // Ephemeral so switching the mandala on here never writes through to the
    // animation panel's own saved visibility settings.
    const visibility = new AnimationVisibilityStateManager({ ephemeral: true });

    orchestrator.initializeWithDomainData(hydrated);
    animState.setSequenceData(hydrated);
    animState.setTotalSteps(hydrated.steps.length);

    playback = { sequence: hydrated, orchestrator, animState, visibility };
    startTime = null;
    frameId = requestAnimationFrame(tick);
  }

  $effect(() => {
    const target = sequence;
    if (playback?.sequence.id === target.id) return;
    teardown();
    void start(target);
  });

  // Drive prop states from the beat counter.
  $effect(() => {
    const position = currentStep;
    const active = playback;
    if (!active || !active.orchestrator.isInitialized()) return;

    const stepCount = active.sequence.steps?.length || 1;
    const step = (position % stepCount) + 1;
    active.orchestrator.calculateState(step);
    const states = active.orchestrator.getCurrentPropStates();
    active.animState.setPropStates(states.blue, states.red);
  });

  const frame = $derived.by(() => {
    const active = playback;
    if (!active) return null;
    const stepCount = active.sequence.steps?.length || 1;
    const step = (currentStep % stepCount) + 1;
    const index = Math.floor(Math.max(0, Math.min(step - 1, stepCount - 1)));
    return { step, stepData: active.sequence.steps?.[index] ?? null };
  });

  // A repeating word always displays in its smallest form — FΨ, never FΨFΨFΨFΨ.
  const displayWord = $derived.by(() => {
    const raw = playback?.sequence.word || playback?.sequence.name || "";
    return raw ? simplifyRepeatedWord(raw) : null;
  });

  /**
   * The engine only builds the mandala overlay canvas on a *change* in the
   * mandala flag (playback-sync.ts:404). Switching it on after the canvas
   * reports ready guarantees that change actually fires.
   */
  function enableMandala() {
    playback?.visibility.setVisibility("mandala", true);
  }

  onDestroy(() => {
    loadToken++;
    teardown();
  });
</script>

{#if playback && frame}
  <div class="preview-layer" transition:fade={{ duration: DURATION.fast }} aria-hidden="true">
    <AnimatorCanvas
      blueProp={playback.animState.bluePropState}
      redProp={playback.animState.redPropState}
      sequenceData={playback.sequence}
      gridVisible={true}
      gridMode={playback.sequence.gridMode ?? null}
      letter={frame.stepData?.letter ?? null}
      stepData={frame.stepData}
      currentStep={frame.step}
      isPlaying={true}
      word={displayWord}
      previewDarkMode={true}
      hideTkaGlyph={true}
      hideStepNumbers={true}
      hideProgressBar={true}
      disableContextMenu={true}
      visibilityManagerOverride={playback.visibility}
      onInitialized={enableMandala}
    />
  </div>
{/if}

<style>
  .preview-layer {
    position: absolute;
    inset: 0;
    z-index: 2;
    /* The card owns the click. Let taps fall through to it. */
    pointer-events: none;
    /* Deliberately NOT --theme-panel-bg: that token is translucent, and the
       static thumbnail ghosting through at 25% doubles the word and muddies
       the mandala. The preview runs previewDarkMode, so this is its floor. */
    background: #08080f;
    container-type: size;
  }

  @media (prefers-reduced-motion: reduce) {
    .preview-layer {
      display: none;
    }
  }
</style>
