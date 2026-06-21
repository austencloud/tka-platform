<!-- src/lib/shared/gamification/components/PropUnlockCelebration.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { AdditionalLayerProps } from "$lib/shared/animation-engine/domain/types/trail-capture-types";
  import { interpolatePropAngles } from "$lib/shared/animation-engine/services/prop-interpolator";
  import { rotateSequence } from "$lib/shared/create/services/sequence-transforms";
  import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";
  import { getPropDemoLoop } from "../data/prop-demo-loop";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import { propCelebration, closePropCelebration } from "../state/prop-celebration-state.svelte";
  import { remainingLockedProps } from "../state/prop-collection-state.svelte";
  import { getPropUnlockManager } from "../get-prop-unlock-manager";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";

  const DEFAULT_PROP_STATE: PropState = { centerPathAngle: 0, staffRotationAngle: 0 };

  let phase = $state<"pick" | "reveal">("pick");
  let chosen = $state<PropType | null>(null);

  const locked = $derived(remainingLockedProps());
  const isGuest = $derived(!authState.isFullAccount);

  let base = $state<SequenceData | null>(null);
  let rotated = $state<SequenceData[]>([]);
  let playheadBeat = $state(0);
  const SPEED = 0.3; // beats per second — validated tunnel cadence

  async function choose(prop: PropType) {
    chosen = prop;
    phase = "reveal";
    base = null;
    rotated = [];
    playheadBeat = 0;
    const seq = await getPropDemoLoop();
    const copies = await Promise.all([
      rotateSequence(seq, 2, motionQueryHandler),
      rotateSequence(seq, 4, motionQueryHandler),
      rotateSequence(seq, 6, motionQueryHandler),
    ]);
    // Guard against a Back→re-choose race: only commit if this is still the
    // active reveal for the prop we started with.
    if (chosen !== prop) return;
    base = seq;
    rotated = copies;
  }

  onMount(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (base && base.steps.length > 0) {
        playheadBeat = (playheadBeat + dt * SPEED) % base.steps.length;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  type LayerProps = { blue: PropState; red: PropState; step: StepData | null; stepOneBased: number };
  function propsFor(seq: SequenceData | null): LayerProps {
    if (!seq || seq.steps.length === 0) {
      return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE }, step: null, stepOneBased: 1 };
    }
    const n = seq.steps.length;
    const idx = Math.min(n - 1, Math.max(0, Math.floor(playheadBeat)));
    const progress = Math.max(0, Math.min(0.9999, playheadBeat - Math.floor(playheadBeat)));
    const step = seq.steps[idx] ?? null;
    if (!step) return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE }, step: null, stepOneBased: idx + 1 };
    const r = interpolatePropAngles(step, progress);
    return {
      blue: r.isValid ? (r.blueAngles ?? { ...DEFAULT_PROP_STATE }) : { ...DEFAULT_PROP_STATE },
      red: r.isValid ? (r.redAngles ?? { ...DEFAULT_PROP_STATE }) : { ...DEFAULT_PROP_STATE },
      step,
      stepOneBased: idx + 1,
    };
  }
  const baseLayer = $derived(propsFor(base));
  const additionalLayers = $derived<AdditionalLayerProps[]>(
    rotated.map((seq) => {
      const p = propsFor(seq);
      return { blueProp: p.blue, redProp: p.red };
    }),
  );
  // Canvas needs the enum STRING; heading/toast need the human LABEL.
  const chosenPropStr = $derived(chosen ? String(chosen) : null);
  const chosenLabel = $derived(chosen ? getPropTypeDisplayInfo(chosen).label : "");
  const gridMode = $derived(base?.gridMode ?? GridMode.DIAMOND);

  function reset() {
    phase = "pick";
    chosen = null;
    base = null;
    rotated = [];
  }

  async function confirm() {
    if (!chosen) return;
    const label = getPropTypeDisplayInfo(chosen).label;
    await getPropUnlockManager().claimPick(chosen);
    toast.success(`${label} added to your props.`);
    closePropCelebration();
    reset();
  }
  function onClose() {
    closePropCelebration();
    reset();
  }
  function signUpToKeep() {
    authDrawerState.show("signup");
  }
</script>

<BaseModal open={propCelebration.isOpen} size="fit" class="chromeless" onclose={onClose}>
  <div class="celebration">
    {#if phase === "pick"}
      <h2 data-animate="1">You've earned a new prop</h2>
      <p class="sub" data-animate="2">Pick one to add to your collection.</p>
      <div class="grid" data-animate="3">
        {#each locked as prop (prop)}
          <button class="tile" onclick={() => choose(prop)}>
            <span class="tile-image">
              <PropCompositionPreview propType={prop} neutral />
            </span>
            <span class="tile-label">{getPropTypeDisplayInfo(prop).label}</span>
          </button>
        {/each}
      </div>
      {#if isGuest}
        <button class="keep" data-animate="4" onclick={signUpToKeep}>Sign up to keep your collection</button>
      {/if}
    {:else}
      <h2 data-animate="1">Meet your {chosenLabel}</h2>
      <div class="stage" data-animate="2">
        {#if base}
          <AnimatorCanvas
            blueProp={baseLayer.blue}
            redProp={baseLayer.red}
            {additionalLayers}
            bluePropType={chosenPropStr}
            redPropType={chosenPropStr}
            sequenceData={base}
            stepData={baseLayer.step}
            currentStep={baseLayer.stepOneBased}
            isPlaying={true}
            {gridMode}
            gridVisible={true}
            hideHeader={true}
            hideProgressBar={true}
            hideTkaGlyph={true}
            hideStepNumbers={true}
            fillContainer={true}
            fireConfig={{ disableFrameCache: true }}
          />
        {:else}
          <div class="loading">Summoning…</div>
        {/if}
      </div>
      <div class="actions">
        <button class="back" onclick={reset}>Back</button>
        <button class="confirm" onclick={confirm}>Add to my props</button>
      </div>
    {/if}
  </div>
</BaseModal>

<style>
  .celebration {
    width: min(420px, calc(100vw - 32px));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    color: var(--theme-text, #fff);
    text-align: center;
  }
  h2 { margin: 0; font-size: 1.3rem; }
  .sub { margin: 0; opacity: 0.7; font-size: 0.9rem; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 10px;
    max-height: 320px;
    overflow-y: auto;
  }
  .tile {
    aspect-ratio: 1 / 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    color: inherit;
    cursor: pointer;
    transition: transform 0.15s, background 0.15s, border-color 0.15s;
  }
  .tile:hover {
    transform: scale(1.05);
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(150, 120, 240, 0.6);
  }
  .tile-image {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
  }
  .tile-image :global(.prop-composition-preview) {
    width: 100%;
    height: 100%;
  }
  .tile-label { font-size: 0.72rem; opacity: 0.85; }
  .keep {
    background: none;
    border: none;
    color: var(--theme-accent, #b14ddb);
    font-size: 0.82rem;
    cursor: pointer;
    text-decoration: underline;
  }
  .stage {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 14px;
    overflow: hidden;
    background: #07070b;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .loading { width: 100%; height: 100%; display: grid; place-items: center; opacity: 0.5; }
  .actions { display: flex; gap: 10px; justify-content: center; }
  .back, .confirm {
    padding: 10px 18px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 0.9rem;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
  }
  .confirm {
    background: linear-gradient(135deg, #6d5ef0, #b14ddb);
    border-color: transparent;
    color: #fff;
  }
  @media (prefers-reduced-motion: reduce) {
    .tile { transition: none; }
    .tile:hover { transform: none; }
  }
</style>
