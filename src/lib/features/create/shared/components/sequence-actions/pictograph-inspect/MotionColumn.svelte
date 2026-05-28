<script lang="ts">
  /**
   * Motion Column
   *
   * Displays motion data for a single color (blue or red).
   * Reusable component for the pictograph inspector modal.
   */
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import type { PipelineDiagnostics } from "$lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import { formatMotionText } from "./formatters";
  import PipelineTraceSection from "./PipelineTraceSection.svelte";
  import CollapsibleSection from "$lib/features/admin/components/feature-flags/shared/CollapsibleSection.svelte";

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
    open: boolean;
    onToggle: (next: boolean) => void;
  }

  let { color, motion, rotationOverride, copiedSection, onCopy, diagnostics, stepData, onDiagnosticsChanged, open, onToggle }: Props =
    $props();

  let pipelineTraceRef: PipelineTraceSection | undefined = $state();

  export function handleWASDKeydown(event: KeyboardEvent): boolean {
    return pipelineTraceRef?.handleKeydown(event) ?? false;
  }

  export function enterEditMode(): void {
    pipelineTraceRef?.enterEditMode();
  }

  const colorClass = $derived(color === "blue" ? "blue-column" : "red-column");
  const label = $derived(color === "blue" ? "Blue Motion" : "Red Motion");
</script>

<CollapsibleSection
  title={label}
  {open}
  onToggle={onToggle}
  iconColor={color === "blue" ? "var(--prop-blue, #58a6ff)" : "var(--prop-red, #f85149)"}
  icon="fa-circle"
>
  <section class="column {colorClass}">
    <div class="column-header">
      <button
        class="copy-btn"
        onclick={async () =>
          onCopy(await formatMotionText(motion, color, rotationOverride), color)}
        title="Copy {label}"
      >
        <i class="fas fa-copy" aria-hidden="true"></i>
        {#if copiedSection === color}<span class="copied-label">Copied</span>{/if}
      </button>
    </div>

    {#if motion}
      <div class="data-block">
        <div class="data-row"><span class="key">type</span><span class="val type-val">{motion.motionType}</span></div>
        <div class="data-row"><span class="key">turns</span><span class="val">{motion.turns === "fl" ? "float" : motion.turns}</span></div>
        <div class="data-row"><span class="key">rotation</span><span class="val">{motion.rotationDirection}</span></div>
        <div class="data-row"><span class="key">startLoc</span><span class="val">{motion.startLocation}</span></div>
        <div class="data-row"><span class="key">endLoc</span><span class="val">{motion.endLocation}</span></div>
        <div class="data-row"><span class="key">arrowLoc</span><span class="val">{motion.arrowLocation}</span></div>
        <div class="data-row"><span class="key">startOri</span><span class="val">{motion.startOrientation}</span></div>
        <div class="data-row"><span class="key">endOri</span><span class="val">{motion.endOrientation}</span></div>
        {#if motion.prefloatMotionType}
          <div class="data-row warn-row"><span class="key">prefloat</span><span class="val warn-val">{motion.prefloatMotionType}</span></div>
        {/if}
      </div>

      <div class="subsection">
        <h4>Arrow placement</h4>
        <div class="data-block">
          <div class="data-row"><span class="key">posX</span><span class="val num">{motion.arrowPlacementData?.positionX?.toFixed(2) ?? "-"}</span></div>
          <div class="data-row"><span class="key">posY</span><span class="val num">{motion.arrowPlacementData?.positionY?.toFixed(2) ?? "-"}</span></div>
          <div class="data-row"><span class="key">angle</span><span class="val num">{motion.arrowPlacementData?.rotationAngle?.toFixed(1) ?? "-"}°</span></div>
          <div class="data-row"><span class="key">mirrored</span><span class="val bool">{motion.arrowPlacementData?.svgMirrored ? "true" : "false"}</span></div>
          {#if rotationOverride}
            <div class="data-row" class:override-active={rotationOverride.hasOverride}><span class="key">rotOverride</span><span class="val bool">{rotationOverride.hasOverride ? "true" : "false"}</span></div>
          {/if}
          {#if motion.arrowPlacementData?.manualAdjustmentX || motion.arrowPlacementData?.manualAdjustmentY}
            <div class="data-row warn-row"><span class="key">manual</span><span class="val num">({motion.arrowPlacementData?.manualAdjustmentX?.toFixed(2) ?? 0}, {motion.arrowPlacementData?.manualAdjustmentY?.toFixed(2) ?? 0})</span></div>
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
      <div class="empty-state">No {color} motion</div>
    {/if}
  </section>
</CollapsibleSection>

<style>
  .column {
    display: flex;
    flex-direction: column;
    gap: 0;
    font-family: inherit;
  }
  .column-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-bottom: 8px;
    margin-bottom: 6px;
  }
  .copy-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    min-height: 36px;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    color: var(--theme-text, #fff);
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
    font-family: inherit;
  }
  .copy-btn:hover { border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2)); }
  .copy-btn:focus-visible { outline: 2px solid var(--theme-accent, #58a6ff); outline-offset: 1px; }
  .copied-label { color: var(--semantic-success, #7ee787); font-weight: 600; }
  /* Read-only info: pack key/value pairs into a dense 2-col grid so the
     section stays short instead of one row per value. */
  .data-block {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 16px;
    row-gap: 2px;
  }
  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 4px 8px;
    gap: 10px;
    border-radius: 6px;
    min-width: 0;
  }
  /* Anomaly rows span the full width so they stay prominent. */
  .data-row.warn-row,
  .data-row.override-active { grid-column: 1 / -1; }
  .data-row.warn-row { background: color-mix(in srgb, var(--semantic-warning, #d29922) 14%, transparent); }
  .data-row.override-active { background: color-mix(in srgb, var(--semantic-success, #3fb950) 14%, transparent); }
  .data-row.override-active .val { color: var(--semantic-success, #7ee787); font-weight: 600; }
  .key {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    white-space: nowrap;
  }
  .val {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, #fff);
    text-align: right;
    user-select: all;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .val.type-val { color: var(--semantic-warning, #ffa657); font-weight: 600; }
  .val.num { color: var(--semantic-info, #79c0ff); }
  .val.bool { color: var(--prop-red, #ff7b72); }
  .val.warn-val { color: var(--semantic-warning, #d29922); }
  .subsection {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }
  .subsection h4 {
    margin: 0 0 6px 0;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .empty-state {
    padding: 20px;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
  }
</style>
