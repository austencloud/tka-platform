<!--
  DurationPatternView.svelte

  Chrome-free duration-pattern editor body, rendered INLINE inside the Sequence
  Actions panel as a drill-down view (no Drawer wrapper). Single-lane duration
  binding via PatternStripEditor; Apply tiles the strip to a DurationPattern and
  runs the proven duration-pattern-manager.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import PatternStripEditor from "$lib/shared/create/components/pattern-strip/PatternStripEditor.svelte";
  import type {
    StripBinding,
    StripValue,
  } from "$lib/shared/create/components/pattern-strip/pattern-strip-types";
  import { DURATION_RHYTHMS } from "$lib/shared/create/domain/rhythm/rhythm-catalog";
  import { stampSingle } from "$lib/shared/create/domain/rhythm/rhythm-mask";
  import { stripToDurationPattern } from "../../domain/pattern-strip-apply";
  import * as durationPatternManager from "$lib/features/create/shared/services/duration-pattern-manager";
  import {
    analyzeConstantPropSpeed,
    type ConstantPropSpeedFailure,
    type ConstantPropSpeedStep,
  } from "$lib/features/create/shared/services/constant-prop-speed";
  import type { TargetHand } from "$lib/shared/create/domain/panel-types";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import HandSelector from "./HandSelector.svelte";

  type DurationResult = {
    sequence: SequenceData;
    warnings?: readonly string[];
  };

  interface Props {
    sequence: SequenceData | null;
    targetHand: TargetHand;
    onTargetHandChange: (hand: TargetHand) => void;
    onPreview: (result: DurationResult) => void;
    onApply: (result: DurationResult) => void;
  }

  let { sequence, targetHand, onTargetHandChange, onPreview, onApply }: Props =
    $props();

  const DUR_VALUES: StripValue[] = [1, 1.25, 1.5, 2, 4];
  const fmtDur = (v: StripValue) => (v === 1 ? "1×" : `${v}×`);
  const binding: StripBinding = {
    lanes: 1,
    rhythms: DURATION_RHYTHMS,
    valueList: DUR_VALUES,
    amountList: [1.25, 1.5, 2, 4],
    base: 1,
    format: fmtDur,
    laneColors: ["accent"],
    laneLabels: ["Hold"],
  };

  const seqLen = $derived(sequence?.steps.length ?? 8);
  const initPeriod = $derived(seqLen % 4 === 0 ? 4 : seqLen % 2 === 0 ? 2 : 1);

  let strip = $state<StripValue[][]>([[2, 1, 1, 1]]);
  const speedAnalysis = $derived(
    sequence ? analyzeConstantPropSpeed(sequence, targetHand) : null
  );
  const speedPatternLoaded = $derived.by(() => {
    if (!speedAnalysis?.success) return false;
    const current = strip[0] ?? [];
    return (
      current.length === speedAnalysis.durations.length &&
      current.every(
        (duration, index) =>
          Math.abs(Number(duration) - speedAnalysis.durations[index]!) < 1e-9
      )
    );
  });

  // Seed the downbeat rhythm (P---) at x2 hold once on mount (entering view).
  onMount(() => {
    strip = [stampSingle(DURATION_RHYTHMS[2]!, initPeriod, 2, 1)];
  });

  function applyValues(values: StripValue[][]): DurationResult | null {
    if (!sequence) return null;
    const pattern = stripToDurationPattern(
      values[0]! as number[],
      sequence.steps.length
    );
    const result = durationPatternManager.applyPattern(pattern, sequence);
    if (result.success && result.sequence) {
      return { sequence: result.sequence, warnings: result.warnings };
    }
    return null;
  }

  function previewStrip(nextStrip: StripValue[][]) {
    strip = nextStrip;
    const result = applyValues(nextStrip);
    if (result) onPreview(result);
  }

  function previewConstantSpeed() {
    if (!speedAnalysis?.success) return;
    previewStrip([[...speedAnalysis.durations]]);
  }

  function changeTargetHand(hand: TargetHand) {
    onTargetHandChange(hand);
    if (sequence) onPreview({ sequence });
  }

  function applyStrip() {
    const result = applyValues(strip);
    if (result) onApply(result);
  }

  function formatNumber(value: number): string {
    return Number(value.toFixed(2)).toString();
  }

  function formatDegrees(value: number | null): string {
    return value === null ? "No motion" : `${formatNumber(value)}°`;
  }

  function formatBeatList(steps: readonly number[]): string {
    const label = steps.length === 1 ? "beat" : "beats";
    return `${label} ${steps.join(", ")}`;
  }

  function targetLabel(target: TargetHand): string {
    if (target === "blue") return "Left";
    if (target === "red") return "Right";
    return "Both props";
  }

  function failureMessage(failure: ConstantPropSpeedFailure): string {
    const beats = formatBeatList(failure.affectedSteps);
    switch (failure.reason) {
      case "empty-sequence":
        return "Add at least one beat before calculating timing.";
      case "missing-motion":
        if (failure.target === "both") {
          return `One or both props have no motion on ${beats}.`;
        }
        return `${targetLabel(failure.target)} has no motion on ${beats}.`;
      case "zero-spin":
        if (failure.target === "both") {
          return `One or both props do not spin on ${beats}. Timing cannot turn a stopped prop into one continuous rotation.`;
        }
        return `${targetLabel(failure.target)} does not spin on ${beats}. Timing cannot turn a stopped prop into one continuous rotation.`;
      case "direction-change":
        if (failure.target === "both") {
          return `One or both props change direction on ${beats}. Timing cannot make that one continuous rotation.`;
        }
        return `${targetLabel(failure.target)} changes direction on ${beats}. Timing cannot make that one continuous rotation.`;
      case "incompatible-hands":
        return `Left and Right rotate in different proportions on ${beats}, so one shared beat length cannot keep both rates constant.`;
      case "duration-limit":
        return `Exact timing needs a ${formatNumber(failure.requiredMaxDuration ?? 0)}× beat, above the 10× limit.`;
    }
  }

  function stepRate(step: ConstantPropSpeedStep, hand: "blue" | "red"): string {
    const degrees = hand === "blue" ? step.blueDegrees : step.redDegrees;
    const rate =
      hand === "blue" ? step.blueDegreesPerBeat : step.redDegreesPerBeat;
    return `${formatDegrees(degrees)} → ${formatDegrees(rate)}/beat`;
  }
</script>

<div class="pattern-view-body">
  <div class="pattern-view-inner">
    <section class="constant-speed-card" aria-labelledby="constant-speed-title">
      <div class="speed-heading">
        <div>
          <h3 id="constant-speed-title">Constant prop speed</h3>
          <p>Set each beat length from the prop's actual rotation.</p>
        </div>
        {#if speedAnalysis?.success}
          <span class="exact-badge">Exact</span>
        {/if}
      </div>

      <HandSelector value={targetHand} onChange={changeTargetHand} />

      <div class="speed-result" aria-live="polite">
        {#if speedAnalysis?.success}
          <div class="speed-summary">
            {#if speedAnalysis.blueDegreesPerBeat !== null}
              <span
                >Left {formatDegrees(
                  speedAnalysis.blueDegreesPerBeat
                )}/beat</span
              >
            {/if}
            {#if speedAnalysis.redDegreesPerBeat !== null}
              <span
                >Right {formatDegrees(
                  speedAnalysis.redDegreesPerBeat
                )}/beat</span
              >
            {/if}
          </div>

          <ol class="speed-steps" aria-label="Calculated beat timing">
            {#each speedAnalysis.steps as step}
              <li class="speed-step">
                <span class="beat-label">Beat {step.stepNumber}</span>
                <strong>{formatNumber(step.duration ?? 1)}×</strong>
                <span class="rate-lines">
                  {#if targetHand !== "red"}
                    <span>L {stepRate(step, "blue")}</span>
                  {/if}
                  {#if targetHand !== "blue"}
                    <span>R {stepRate(step, "red")}</span>
                  {/if}
                </span>
              </li>
            {/each}
          </ol>

          <button
            class="preview-speed-btn"
            class:loaded={speedPatternLoaded}
            onclick={previewConstantSpeed}
            disabled={speedPatternLoaded}
          >
            {speedPatternLoaded ? "Timing loaded" : "Preview this timing"}
          </button>
        {:else if speedAnalysis}
          <p class="speed-error">{failureMessage(speedAnalysis)}</p>
        {/if}
      </div>
    </section>

    <PatternStripEditor
      {binding}
      sequenceLength={seqLen}
      value={strip}
      onChange={previewStrip}
    />
    <button
      class="apply-btn duration"
      onclick={applyStrip}
      disabled={!sequence}
    >
      Apply to sequence
    </button>
  </div>
</div>

<style>
  .pattern-view-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
  }

  /* Centered content column — see TurnPatternView for rationale. */
  .pattern-view-inner {
    margin: auto;
    width: 100%;
    max-width: 820px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .constant-speed-card {
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
  }

  .speed-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px;
  }

  .speed-heading h3 {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-md, 16px);
    font-weight: 750;
  }

  .speed-heading p {
    margin: 5px 0 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-sm, 14px);
    line-height: 1.4;
  }

  .exact-badge {
    flex: 0 0 auto;
    padding: 4px 8px;
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #2dd4bf) 16%,
      transparent
    );
    color: var(--theme-accent, #2dd4bf);
    font-size: var(--font-size-compact, 12px);
    font-weight: 750;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  :global(.constant-speed-card .hand-selector-section) {
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .speed-result {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0 16px 16px;
  }

  .speed-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .speed-steps {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .speed-step {
    display: grid;
    grid-template-columns: minmax(58px, auto) 50px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 7px 10px;
    border-radius: 9px;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.18));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    font-variant-numeric: tabular-nums;
  }

  .beat-label,
  .rate-lines {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
  }

  .rate-lines {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 2px 12px;
    text-align: right;
  }

  .preview-speed-btn {
    min-height: 48px;
    padding: 0 14px;
    border: 1px solid var(--theme-accent, #2dd4bf);
    border-radius: 10px;
    background: transparent;
    color: var(--theme-accent, #2dd4bf);
    font: inherit;
    font-size: var(--font-size-sm, 14px);
    font-weight: 750;
    cursor: pointer;
  }

  .preview-speed-btn:hover:not(:disabled) {
    background: color-mix(
      in srgb,
      var(--theme-accent, #2dd4bf) 12%,
      transparent
    );
  }

  .preview-speed-btn.loaded {
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
  }

  .preview-speed-btn:disabled {
    cursor: default;
    opacity: 0.8;
  }

  .preview-speed-btn:focus-visible,
  .apply-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #2dd4bf);
    outline-offset: 2px;
  }

  .speed-error {
    margin: 0;
    padding: 12px;
    border-radius: 9px;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.18));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    line-height: 1.45;
  }

  .apply-btn {
    width: 100%;
    min-height: 52px;
    margin: 6px 0 0;
    padding: 0 14px;
    border: none;
    border-radius: 12px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    background: linear-gradient(135deg, var(--theme-accent, #2dd4bf), #0e8f80);
    color: #fff;
  }

  .apply-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 560px) {
    .pattern-view-body {
      padding: 12px;
    }

    .speed-step {
      grid-template-columns: auto 1fr;
    }

    .rate-lines {
      grid-column: 1 / -1;
      justify-content: flex-start;
      text-align: left;
    }
  }
</style>
