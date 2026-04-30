<script lang="ts">
  /**
   * Motion Column
   *
   * Displays motion data for a single color (blue or red).
   * Reusable component for the pictograph inspector modal.
   */
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import type { PipelineDiagnostics } from "$lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics";
  import type { StepData } from "../../../domain/models/StepData";
  import { formatMotionText } from "./formatters";
  import PipelineTraceSection from "./PipelineTraceSection.svelte";

  type MotionColor = "blue" | "red";

  interface Props {
    color: MotionColor;
    motion: MotionData | undefined;
    rotationOverride: { hasOverride: boolean } | null;
    copiedSection: string | null;
    onCopy: (text: string, section: string) => void;
    diagnostics: PipelineDiagnostics | null;
    stepData: StepData;
    onDiagnosticsChanged?: () => void;
  }

  let { color, motion, rotationOverride, copiedSection, onCopy, diagnostics, stepData, onDiagnosticsChanged }: Props =
    $props();

  let pipelineTraceRef: PipelineTraceSection | undefined = $state();

  export function handleWASDKeydown(event: KeyboardEvent): boolean {
    return pipelineTraceRef?.handleKeydown(event) ?? false;
  }

  const colorClass = $derived(color === "blue" ? "blue-column" : "red-column");
  const dotClass = $derived(color === "blue" ? "blue" : "red");
  const label = $derived(color === "blue" ? "Blue Motion" : "Red Motion");
</script>

<section class="column {colorClass}">
  <div class="column-header">
    <h3>
      <span class="color-indicator {dotClass}"></span>
      {label}
    </h3>
    <button
      class="copy-btn"
      onclick={async () =>
        onCopy(await formatMotionText(motion, color, rotationOverride), color)}
      title="Copy {label}"
    >
      <i class="fas fa-copy" aria-hidden="true"></i>
      {#if copiedSection === color}<span class="copied-label">ok</span>{/if}
    </button>
  </div>

  {#if motion}
    <div class="data-block">
      <div class="data-row">
        <span class="key">type</span>
        <span class="val type-val">{motion.motionType}</span>
      </div>
      <div class="data-row">
        <span class="key">turns</span>
        <span class="val">{motion.turns === "fl" ? "float" : motion.turns}</span>
      </div>
      <div class="data-row">
        <span class="key">rotation</span>
        <span class="val">{motion.rotationDirection}</span>
      </div>
      <div class="data-row">
        <span class="key">startLoc</span>
        <span class="val">{motion.startLocation}</span>
      </div>
      <div class="data-row">
        <span class="key">endLoc</span>
        <span class="val">{motion.endLocation}</span>
      </div>
      <div class="data-row">
        <span class="key">arrowLoc</span>
        <span class="val">{motion.arrowLocation}</span>
      </div>
      <div class="data-row">
        <span class="key">startOri</span>
        <span class="val">{motion.startOrientation}</span>
      </div>
      <div class="data-row">
        <span class="key">endOri</span>
        <span class="val">{motion.endOrientation}</span>
      </div>
      {#if motion.prefloatMotionType}
        <div class="data-row warn-row">
          <span class="key">prefloat</span>
          <span class="val warn-val">{motion.prefloatMotionType}</span>
        </div>
      {/if}
    </div>

    <div class="subsection">
      <h4>arrow placement</h4>
      <div class="data-block">
        <div class="data-row">
          <span class="key">posX</span>
          <span class="val num">{motion.arrowPlacementData?.positionX?.toFixed(2) ?? "-"}</span>
        </div>
        <div class="data-row">
          <span class="key">posY</span>
          <span class="val num">{motion.arrowPlacementData?.positionY?.toFixed(2) ?? "-"}</span>
        </div>
        <div class="data-row">
          <span class="key">angle</span>
          <span class="val num">{motion.arrowPlacementData?.rotationAngle?.toFixed(1) ?? "-"}°</span>
        </div>
        <div class="data-row">
          <span class="key">mirrored</span>
          <span class="val bool">{motion.arrowPlacementData?.svgMirrored ? "true" : "false"}</span>
        </div>
        {#if rotationOverride}
          <div class="data-row" class:override-active={rotationOverride.hasOverride}>
            <span class="key">rotOverride</span>
            <span class="val bool">{rotationOverride.hasOverride ? "true" : "false"}</span>
          </div>
        {/if}
        {#if motion.arrowPlacementData?.manualAdjustmentX || motion.arrowPlacementData?.manualAdjustmentY}
          <div class="data-row warn-row">
            <span class="key">manual</span>
            <span class="val num">
              ({motion.arrowPlacementData?.manualAdjustmentX?.toFixed(2) ?? 0},
              {motion.arrowPlacementData?.manualAdjustmentY?.toFixed(2) ?? 0})
            </span>
          </div>
        {/if}
      </div>
    </div>

    <PipelineTraceSection
      {diagnostics}
      {color}
      {stepData}
      {onDiagnosticsChanged}
      bind:this={pipelineTraceRef}
    />
  {:else}
    <div class="empty-state">// no {color} motion</div>
  {/if}
</section>

<style>
  .column {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 0;
    font-family: "SF Mono", "Cascadia Code", "Fira Code", Monaco, Consolas,
      monospace;
  }

  .blue-column {
    background: linear-gradient(135deg, rgba(56, 139, 253, 0.03), #0d1117 40%);
  }

  .red-column {
    background: linear-gradient(135deg, rgba(248, 81, 73, 0.03), #0d1117 40%);
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    margin-bottom: 4px;
    border-bottom: 1px solid #21262d;
  }

  .column-header h3 {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-indicator {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  .color-indicator.blue {
    background: #58a6ff;
  }

  .color-indicator.red {
    background: #f85149;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid #30363d;
    background: transparent;
    color: #8b949e;
    cursor: pointer;
    font-size: 0.7rem;
    font-family: inherit;
    transition: all var(--duration-fast, 0.15s) ease;
  }

  .copy-btn:hover {
    background: #21262d;
    color: #e6edf3;
    border-color: #484f58;
  }

  .copy-btn:focus-visible {
    outline: 2px solid #58a6ff;
    outline-offset: 1px;
  }

  .copied-label {
    color: #7ee787;
    font-weight: 600;
  }

  .data-block {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 8px;
    gap: 12px;
    border-bottom: 1px solid #161b22;
  }

  .data-row:hover {
    background: rgba(136, 198, 255, 0.04);
  }

  .data-row.warn-row {
    background: rgba(210, 153, 34, 0.08);
  }

  .data-row.override-active {
    background: rgba(63, 185, 80, 0.08);
  }

  .data-row.override-active .val {
    color: #7ee787;
    font-weight: 600;
  }

  .key {
    font-size: 0.7rem;
    color: #7d8590;
    white-space: nowrap;
  }

  .val {
    font-size: 0.8rem;
    color: #e6edf3;
    font-weight: 400;
    text-align: right;
    user-select: all;
  }

  .val.type-val {
    color: #ffa657;
    font-weight: 500;
  }

  .val.num {
    color: #79c0ff;
  }

  .val.bool {
    color: #ff7b72;
  }

  .val.warn-val {
    color: #d29922;
  }

  .subsection {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #21262d;
  }

  .subsection h4 {
    margin: 0 0 4px 0;
    font-size: 0.65rem;
    font-weight: 600;
    color: #484f58;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .empty-state {
    padding: 20px;
    text-align: center;
    color: #484f58;
    font-size: var(--font-size-sm, 0.875rem);
  }
</style>
