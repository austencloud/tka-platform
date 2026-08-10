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
  import { onDestroy, untrack } from "svelte";
  import { flyFade, popIn } from "$lib/shared/transitions/motion";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
  import { AnimationStateManager } from "$lib/shared/animation-engine/services/animation-state-manager";
  import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { ensureMotionData } from "$lib/shared/sequence-viewer/services/sequence-motion-loader";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { DURATION, SLIDE, STAGGER } from "$lib/shared/transitions/transitions";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  const { sequence }: { sequence: SequenceData } = $props();

  const BPM = 60;
  const MS_PER_BEAT = 60000 / BPM;

  interface Playback {
    sequence: SequenceData;
    orchestrator: SequenceAnimationOrchestrator;
    animState: ReturnType<typeof createAnimationPanelState>;
  }

  // One per layer, not per playback: the canvas stays mounted while variations
  // swap underneath it, so handing it a fresh manager would reset the mandala.
  // Ephemeral so switching the mandala on here never writes through to the
  // animation panel's own saved visibility settings.
  const visibility = new AnimationVisibilityStateManager({ ephemeral: true });

  let playback = $state<Playback | null>(null);
  let currentStep = $state(0);
  let boxWidth = $state(0);
  let boxHeight = $state(0);
  // The rail follows the free axis: a card wider than it is tall grows one to
  // the right as a vertical carousel, a taller one lays it below. Every card
  // gets a rail — a preview that sometimes carries the notation and sometimes
  // doesn't reads as a bug, not as a size adaptation.
  const railRight = $derived(boxWidth > boxHeight);
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
    dispose(playback);
    playback = null;
  }

  function dispose(target: Playback | null) {
    target?.orchestrator.dispose();
    target?.animState.dispose();
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

    orchestrator.initializeWithDomainData(hydrated);
    animState.setSequenceData(hydrated);
    animState.setTotalSteps(hydrated.steps.length);

    // Swap, don't tear down and rebuild: cycling to another variation mid-play
    // would otherwise blank the card for a frame. The beat phase carries over,
    // so the new sequence picks up where the old one was.
    const outgoing = playback;
    playback = { sequence: hydrated, orchestrator, animState };
    dispose(outgoing);
    if (frameId === null) frameId = requestAnimationFrame(tick);
  }

  $effect(() => {
    const target = sequence;
    if (untrack(() => playback?.sequence.id) === target.id) return;
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
    visibility.setVisibility("mandala", true);
  }

  onDestroy(() => {
    loadToken++;
    teardown();
  });
</script>

<!-- |global on both transitions: the card unmounts this whole component to stop
     the preview, and a local transition would be skipped by that ancestor
     teardown — the animation would vanish instantly instead of settling back
     into the card. -->
{#if playback && frame}
  <div
    class="preview-layer"
    class:rail-right={railRight}
    bind:clientWidth={boxWidth}
    bind:clientHeight={boxHeight}
    transition:popIn|global={{ duration: DURATION.emphasis, start: 0.94 }}
    aria-hidden="true"
  >
    <div class="stage">
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
        visibilityManagerOverride={visibility}
        onInitialized={enableMandala}
      />
    </div>

    <!-- The rail arrives a beat after the animator so the two read as one
         thing settling into place rather than two panels appearing at once. -->
    <div
      class="rail"
      transition:flyFade|global={{
        duration: DURATION.emphasis,
        delay: STAGGER.relaxed,
        x: railRight ? SLIDE.md : 0,
        y: railRight ? 0 : SLIDE.md,
      }}
    >
      {#await import("$lib/shared/timeline/StepStrip.svelte") then mod}
        <mod.default
          sequence={playback.sequence}
          currentStep={frame.step}
          bpm={BPM}
          density="compact"
          fillHeight={true}
          anchor="center"
          orientation={railRight ? "vertical" : "horizontal"}
          loop={false}
          stepPulse={false}
        />
      {/await}
    </div>
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

    display: flex;
    flex-direction: column;
    /* The card's chip row lives at bottom-right, over this layer. Clearing it
       keeps the rail's far cells from disappearing under the play chip. */
    padding-bottom: calc(var(--min-touch-target, 44px) + 12px);
  }

  .preview-layer.rail-right {
    flex-direction: row;
  }

  .stage {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    position: relative;
  }

  .rail {
    flex: 0 0 auto;
    min-width: 0;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Horizontal rail below the animation. */
  .preview-layer:not(.rail-right) .rail {
    height: clamp(64px, 24cqh, 92px);
  }

  /* Vertical rail beside it. */
  .preview-layer.rail-right .rail {
    width: clamp(64px, 20cqw, 96px);
    align-self: stretch;
  }

  @media (prefers-reduced-motion: reduce) {
    .preview-layer {
      display: none;
    }
  }
</style>
