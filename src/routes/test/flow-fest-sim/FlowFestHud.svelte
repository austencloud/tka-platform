<script lang="ts">
  import ActionButton from "$lib/shared/components/selection/ActionButton.svelte";
  import type { FlowFestIntegratedAreaId } from "$lib/features/flow-fest-sim/domain/flow-fest-integrated-world";
  import type { FlowFestMobilityRuntimeUpdate } from "$lib/features/flow-fest-sim/state/flow-fest-mobility-state.svelte";
  import type {
    FlowFestObjective,
    FlowFestProgressState,
  } from "$lib/features/flow-fest-sim/state/flow-fest-progress";
  import type {
    FlowFestBranchId,
    FlowFestRuntimeContract,
    FlowFestRuntimeZone,
  } from "../flow-fest-graybox/flow-fest-runtime-contract";
  import FlowFestFestivalMap from "./FlowFestFestivalMap.svelte";
  import FlowFestUtilityDrawer from "./FlowFestUtilityDrawer.svelte";
  import {
    createFlowFestCampPlan,
    identifyFlowFestPlanLocation,
  } from "./flow-fest-camp-plan";

  interface Props {
    ready: boolean;
    timeLabel: string;
    objective: FlowFestObjective | null;
    progress: FlowFestProgressState | null;
    contract: FlowFestRuntimeContract | null;
    selectedBranch: FlowFestBranchId;
    position: { x: number; z: number };
    headingRadians: number;
    targetZone: FlowFestRuntimeZone | null;
    targetDistance: number | null;
    currentArea: FlowFestIntegratedAreaId | "loading";
    mobility: FlowFestMobilityRuntimeUpdate;
    electricUnicycleSpeedMph: number;
    electricUnicycleSpeedKph: number;
    objectiveActionDisabled: boolean;
    soundOn: boolean;
    showFieldPositioning: boolean;
    captureMode: boolean;
    showReviewTools: boolean;
    onObjectiveAction: () => void;
    onToggleSound: () => void;
    onRestart: () => void;
    onReviewGate: () => void;
    onReviewEntrance: () => void;
    onReviewParkingGate: () => void;
    onReviewCamp: () => void;
    onReviewFestival: () => void;
  }

  let {
    ready,
    timeLabel,
    objective,
    progress,
    contract,
    selectedBranch,
    position,
    headingRadians,
    targetZone,
    targetDistance,
    currentArea,
    mobility,
    electricUnicycleSpeedMph,
    electricUnicycleSpeedKph,
    objectiveActionDisabled,
    soundOn,
    showFieldPositioning,
    captureMode,
    showReviewTools,
    onObjectiveAction,
    onToggleSound,
    onRestart,
    onReviewGate,
    onReviewEntrance,
    onReviewParkingGate,
    onReviewCamp,
    onReviewFestival,
  }: Props = $props();

  let guideOpen = $state(false);
  const campPlan = $derived(
    contract ? createFlowFestCampPlan(contract, selectedBranch) : null
  );
  const location = $derived(
    campPlan ? identifyFlowFestPlanLocation(campPlan, position) : null
  );
</script>

<div class="hud-brand">
  <div class="wordmark">
    <strong>FLOW FEST</strong>
    <span>{timeLabel}</span>
  </div>
  <button
    type="button"
    aria-label="Open festival guide and controls"
    aria-expanded={guideOpen}
    onclick={() => (guideOpen = true)}
  >
    <i class="fas fa-compass" aria-hidden="true"></i>
    <span>Guide</span>
  </button>
</div>

<div class="map-dock">
  <FlowFestFestivalMap
    {contract}
    branch={selectedBranch}
    player={position}
    {headingRadians}
    {targetZone}
    {targetDistance}
    {currentArea}
    {location}
  />
</div>

{#if ready && location}
  <aside
    class="location-cue"
    aria-live="polite"
    data-location-id={location.id}
    data-evidence={location.evidence}
  >
    <span>{location.eyebrow}</span>
    <strong>{location.label}</strong>
  </aside>
{/if}

{#if ready && objective && progress?.phase !== "choose-camp"}
  <section class="objective-card" aria-live="polite">
    <div class="objective-progress" aria-hidden="true">
      <span
        style:width={`${(objective.progressStep / objective.progressTotal) * 100}%`}
      ></span>
    </div>
    <div class="objective-heading">
      <div>
        <span>{objective.eyebrow}</span>
        <h1>{objective.title}</h1>
      </div>
      {#if targetDistance !== null}
        <strong class="objective-distance"
          >{Math.round(targetDistance)} m</strong
        >
      {/if}
    </div>
    <p>{objective.detail}</p>

    {#if objective.actionLabel}
      <ActionButton
        label={objective.actionLabel}
        icon={progress?.phase === "morning"
          ? "fa-arrow-rotate-left"
          : "fa-arrow-right"}
        color="fuse"
        fullWidth
        ariaDisabled={objectiveActionDisabled}
        onclick={onObjectiveAction}
      />
    {/if}
  </section>
{/if}

{#if ready}
  <aside class="mobility-card" aria-live="polite">
    <div class="mobility-heading">
      <span>{mobility.mounted ? "EUC" : "On foot"}</span>
      <strong class:performance={mobility.input.performanceMode}>
        {mobility.mounted
          ? mobility.input.performanceMode
            ? "Performance"
            : "Cruise"
          : "Walking"}
      </strong>
    </div>

    {#if mobility.mounted}
      <div class="mobility-data">
        <div class="speed">
          <strong>{electricUnicycleSpeedMph.toFixed(1)}</strong>
          <span
            >mph<small>{electricUnicycleSpeedKph.toFixed(1)} km/h</small></span
          >
        </div>
        <div class="battery">
          <span
            ><i style:width={`${mobility.dynamics.batteryPercent}%`}></i></span
          >
          <strong>{Math.round(mobility.dynamics.batteryPercent)}%</strong>
        </div>
      </div>
    {/if}

    <div class="mobility-prompt">
      <kbd>E</kbd>
      <span>{mobility.interactionMessage}</span>
    </div>
  </aside>
{/if}

<FlowFestUtilityDrawer
  bind:isOpen={guideOpen}
  mounted={mobility.mounted}
  {soundOn}
  {showFieldPositioning}
  {captureMode}
  {showReviewTools}
  {onToggleSound}
  {onRestart}
  {onReviewGate}
  {onReviewEntrance}
  {onReviewParkingGate}
  {onReviewCamp}
  {onReviewFestival}
/>

<style>
  .hud-brand,
  .location-cue,
  .objective-card,
  .mobility-card {
    border: 1px solid var(--sim-stroke);
    color: var(--sim-text);
    background: var(--sim-panel-strong);
    box-shadow: 0 1.2rem 3rem rgba(2, 7, 4, 0.28);
  }

  .hud-brand {
    position: absolute;
    inset-block-start: clamp(0.75rem, 1.4vw, 1.5rem);
    inset-inline-start: clamp(0.75rem, 1.4vw, 1.5rem);
    z-index: 34;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.48rem;
    border-radius: 0.9rem;
    transform: scale(var(--sim-ui-scale));
    transform-origin: top left;
  }

  .wordmark {
    display: grid;
    gap: 0.02rem;
    min-inline-size: 7.3rem;
    padding-inline: 0.42rem 0.15rem;
  }

  .wordmark strong {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 1.05rem;
    font-weight: 620;
    letter-spacing: 0.07em;
  }

  .wordmark span {
    color: var(--sim-muted);
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .hud-brand button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.42rem;
    min-block-size: var(--min-touch-target);
    padding-inline: 0.78rem;
    border: 1px solid var(--sim-stroke);
    border-radius: 0.65rem;
    color: var(--sim-text);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.055));
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    cursor: pointer;
  }

  .hud-brand button:hover,
  .hud-brand button:focus-visible {
    border-color: var(--sim-accent);
    outline: none;
  }

  .hud-brand button i {
    color: var(--sim-accent);
  }

  .map-dock {
    --festival-map-width: clamp(20rem, 25vw, 28rem);
    position: absolute;
    inset-block-start: clamp(0.75rem, 1.4vw, 1.5rem);
    inset-inline-end: clamp(0.75rem, 1.4vw, 1.5rem);
    z-index: 33;
    transform: scale(var(--sim-ui-scale));
    transform-origin: top right;
  }

  .location-cue {
    position: absolute;
    inset-block-start: clamp(0.75rem, 1.4vw, 1.5rem);
    inset-inline-start: 50%;
    z-index: 32;
    display: grid;
    min-inline-size: 13rem;
    max-inline-size: 21rem;
    padding: 0.55rem 0.9rem 0.62rem;
    border-radius: 0.8rem;
    text-align: center;
    transform: translateX(-50%) scale(var(--sim-ui-scale));
    transform-origin: top center;
    pointer-events: none;
  }

  .location-cue span {
    color: var(--sim-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 820;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .location-cue strong {
    overflow: hidden;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 760;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .objective-card {
    position: absolute;
    inset-inline-start: clamp(0.75rem, 1.4vw, 1.5rem);
    inset-block-end: clamp(0.75rem, 1.4vw, 1.5rem);
    z-index: 35;
    display: grid;
    gap: 0.68rem;
    inline-size: min(23rem, calc(100vw - 2rem));
    padding: 0.9rem;
    border-radius: 1rem;
    transform: scale(var(--sim-ui-scale));
    transform-origin: bottom left;
  }

  .objective-progress {
    block-size: 0.18rem;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
  }

  .objective-progress span {
    display: block;
    block-size: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--sim-accent), #ed6f56);
    transition: width 480ms ease;
  }

  .objective-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .objective-heading > div {
    display: grid;
    min-inline-size: 0;
  }

  .objective-heading span {
    color: var(--sim-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 820;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1,
  p {
    margin: 0;
  }

  h1 {
    margin-block-start: 0.12rem;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(1.35rem, 2vw, 1.75rem);
    font-weight: 560;
    line-height: 1.02;
  }

  p {
    display: -webkit-box;
    overflow: hidden;
    color: var(--sim-muted);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.42;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .objective-distance {
    flex: 0 0 auto;
    min-inline-size: 4.5rem;
    color: var(--sim-mint);
    font-size: 1rem;
    font-variant-numeric: tabular-nums;
    text-align: end;
  }

  .mobility-card {
    position: absolute;
    inset-inline-end: clamp(0.75rem, 1.4vw, 1.5rem);
    inset-block-end: clamp(0.75rem, 1.4vw, 1.5rem);
    z-index: 34;
    display: grid;
    gap: 0.55rem;
    inline-size: 14rem;
    padding: 0.75rem;
    border-radius: 0.9rem;
    transform: scale(var(--sim-ui-scale));
    transform-origin: bottom right;
    pointer-events: none;
  }

  .mobility-heading,
  .speed,
  .battery,
  .mobility-prompt {
    display: flex;
    align-items: center;
  }

  .mobility-heading,
  .battery {
    justify-content: space-between;
    gap: 0.65rem;
  }

  .mobility-heading > span {
    color: var(--sim-muted);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 780;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .mobility-heading > strong {
    min-inline-size: 6.5rem;
    color: var(--sim-mint);
    font-size: var(--font-size-compact, 0.75rem);
    text-align: end;
  }

  .mobility-heading > strong.performance {
    color: var(--sim-accent);
  }

  .mobility-data {
    display: grid;
    gap: 0.45rem;
  }

  .speed {
    align-items: flex-end;
    gap: 0.48rem;
  }

  .speed > strong {
    min-inline-size: 4.3rem;
    font:
      580 2.35rem/0.9 Georgia,
      "Times New Roman",
      serif;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.04em;
  }

  .speed > span {
    display: grid;
    color: var(--sim-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    text-transform: uppercase;
  }

  .speed small {
    color: var(--sim-muted);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    text-transform: none;
  }

  .battery > span {
    flex: 1;
    block-size: 0.3rem;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
  }

  .battery i {
    display: block;
    block-size: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #67cfab, #c4e58c);
    transition: width 180ms linear;
  }

  .battery strong {
    min-inline-size: 3rem;
    color: var(--sim-mint);
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
    text-align: end;
  }

  .mobility-prompt {
    gap: 0.5rem;
    min-block-size: 2.45rem;
    padding: 0.35rem 0.45rem;
    border: 1px solid rgba(255, 180, 95, 0.2);
    border-radius: 0.62rem;
    background: rgba(255, 180, 95, 0.055);
  }

  .mobility-prompt span {
    overflow: hidden;
    font-size: var(--font-size-compact, 0.75rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: 2rem;
    min-block-size: 1.8rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-block-end-color: rgba(255, 255, 255, 0.4);
    border-radius: 0.42rem;
    background: rgba(255, 255, 255, 0.07);
    font:
      720 var(--font-size-compact, 0.75rem) / 1 ui-monospace,
      monospace;
  }

  @media (max-width: 46rem) {
    .location-cue {
      display: none;
    }

    .hud-brand {
      inset-block-start: 0.55rem;
      inset-inline-start: 0.55rem;
      gap: 0.35rem;
      padding: 0.35rem;
    }

    .wordmark {
      min-inline-size: 0;
      padding-inline: 0.28rem;
    }

    .wordmark strong {
      font-size: 0.9rem;
    }

    .wordmark span,
    .hud-brand button span {
      display: none;
    }

    .hud-brand button {
      inline-size: var(--min-touch-target);
      padding: 0;
    }

    .map-dock {
      --festival-map-width: min(11rem, calc(100vw - 12.875rem));
      inset-block-start: 0.55rem;
      inset-inline-end: 0.55rem;
    }

    .objective-card {
      inset-inline: 0.55rem;
      inset-block-end: 0.55rem;
      inline-size: auto;
      padding: 0.72rem;
    }

    .objective-card p {
      display: none;
    }

    .mobility-card {
      inset-block: 12rem auto;
      inset-inline: auto 0.55rem;
      inline-size: 10.5rem;
      gap: 0.35rem;
      padding: 0.55rem;
      transform-origin: top right;
    }

    .speed > strong {
      min-inline-size: 3.5rem;
      font-size: 1.8rem;
    }

    .mobility-prompt {
      display: none;
    }
  }

  @media (min-width: 46.01rem) and (max-width: 70rem) {
    .location-cue {
      display: none;
    }
  }

  @media (max-height: 31rem) and (min-width: 40rem) {
    .hud-brand {
      inset-block-start: 0.5rem;
    }

    .map-dock {
      --festival-map-width: 17rem;
      inset-block-start: 0.5rem;
      inset-inline-end: 0.5rem;
    }

    .objective-card {
      inset-block-end: 0.5rem;
      inline-size: 21rem;
      gap: 0.42rem;
      padding: 0.62rem;
    }

    .objective-card p {
      display: none;
    }

    .mobility-card {
      inset-inline-end: 0.5rem;
      inset-block-end: 0.5rem;
      inline-size: 11rem;
      gap: 0.3rem;
      padding: 0.5rem;
    }

    .mobility-prompt {
      display: none;
    }

    .speed > strong {
      font-size: 1.8rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .objective-progress span,
    .battery i {
      transition: none;
    }
  }
</style>
