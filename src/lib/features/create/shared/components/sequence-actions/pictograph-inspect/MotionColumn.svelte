<script lang="ts">
  /**
   * Motion Column
   *
   * Displays motion data for a single color (blue or red).
   * Reusable component for the pictograph inspector modal.
   */
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import { formatMotionText } from "./formatters";

  type MotionColor = "blue" | "red";

  interface Props {
    color: MotionColor;
    motion: MotionData | undefined;
    rotationOverride: { hasOverride: boolean } | null;
    copiedSection: string | null;
    onCopy: (text: string, section: string) => void;
  }

  let { color, motion, rotationOverride, copiedSection, onCopy }: Props =
    $props();

  const colorClass = $derived(color === "blue" ? "blue-column" : "red-column");
  const dotClass = $derived(color === "blue" ? "blue" : "red");
  const label = $derived(color === "blue" ? "Blue Motion" : "Red Motion");
</script>

<section class="column {colorClass}">
  <div class="column-header">
    <h3><span class="dot {dotClass}"></span> {label}</h3>
    <button
      class="copy-btn"
      onclick={async () =>
        onCopy(await formatMotionText(motion, color, rotationOverride), color)}
      title="Copy {label}"
    >
      <i class="fas fa-copy" aria-hidden="true"></i>
      {#if copiedSection === color}<span class="copied-label">Copied!</span
        >{/if}
    </button>
  </div>

  {#if motion}
    <div class="data-block">
      <div class="data-row">
        <span class="key">Type</span>
        <span class="val">{motion.motionType}</span>
      </div>
      <div class="data-row">
        <span class="key">Turns</span>
        <span class="val">{motion.turns === "fl" ? "float" : motion.turns}</span
        >
      </div>
      <div class="data-row">
        <span class="key">Rotation</span>
        <span class="val">{motion.rotationDirection}</span>
      </div>
      <div class="data-row">
        <span class="key">Start Loc</span>
        <span class="val">{motion.startLocation}</span>
      </div>
      <div class="data-row">
        <span class="key">End Loc</span>
        <span class="val">{motion.endLocation}</span>
      </div>
      <div class="data-row">
        <span class="key">Arrow Loc</span>
        <span class="val">{motion.arrowLocation}</span>
      </div>
      <div class="data-row">
        <span class="key">Start Ori</span>
        <span class="val">{motion.startOrientation}</span>
      </div>
      <div class="data-row">
        <span class="key">End Ori</span>
        <span class="val">{motion.endOrientation}</span>
      </div>
      {#if motion.prefloatMotionType}
        <div class="data-row warn">
          <span class="key">Prefloat</span>
          <span class="val">{motion.prefloatMotionType}</span>
        </div>
      {/if}
    </div>

    <div class="subsection">
      <h4>Arrow Placement</h4>
      <div class="data-block compact">
        <div class="data-row">
          <span class="key">Pos X</span>
          <span class="val mono"
            >{motion.arrowPlacementData?.positionX?.toFixed(2) ?? "N/A"}</span
          >
        </div>
        <div class="data-row">
          <span class="key">Pos Y</span>
          <span class="val mono"
            >{motion.arrowPlacementData?.positionY?.toFixed(2) ?? "N/A"}</span
          >
        </div>
        <div class="data-row">
          <span class="key">Rotation</span>
          <span class="val mono"
            >{motion.arrowPlacementData?.rotationAngle?.toFixed(1) ??
              "N/A"}°</span
          >
        </div>
        <div class="data-row">
          <span class="key">Mirrored</span>
          <span class="val"
            >{motion.arrowPlacementData?.svgMirrored ? "Yes" : "No"}</span
          >
        </div>
        {#if rotationOverride}
          <div
            class="data-row"
            class:override-active={rotationOverride.hasOverride}
          >
            <span class="key">Rot Override</span>
            <span class="val"
              >{rotationOverride.hasOverride ? "YES" : "No"}</span
            >
          </div>
        {/if}
        {#if motion.arrowPlacementData?.manualAdjustmentX || motion.arrowPlacementData?.manualAdjustmentY}
          <div class="data-row warn">
            <span class="key">Manual</span>
            <span class="val mono">
              ({motion.arrowPlacementData?.manualAdjustmentX?.toFixed(2) ?? 0},
              {motion.arrowPlacementData?.manualAdjustmentY?.toFixed(2) ?? 0})
            </span>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="empty-state">No {color} motion</div>
  {/if}
</section>

<style>
  .column {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .blue-column {
    border-left: 3px solid rgba(59, 130, 246, 0.6);
  }

  .red-column {
    border-left: 3px solid rgba(239, 68, 68, 0.6);
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .column-header h3 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--theme-text);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .dot.blue {
    background: var(--semantic-info);
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
  }

  .dot.red {
    background: var(--semantic-error);
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke-strong);
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: 0.75rem;
    transition: all var(--duration-fast) ease;
  }

  .copy-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .copied-label {
    color: var(--semantic-success);
    font-weight: 600;
  }

  .data-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .data-block.compact {
    gap: 4px;
  }

  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.25);
    border-radius: 6px;
    gap: 12px;
  }

  .data-row.warn {
    background: rgba(251, 191, 36, 0.15);
    border: 1px solid rgba(251, 191, 36, 0.3);
  }

  .data-row.override-active {
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid rgba(34, 197, 94, 0.4);
  }

  .data-row.override-active .val {
    color: var(--semantic-success);
    font-weight: 700;
  }

  .key {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .val {
    font-size: 0.85rem;
    color: var(--theme-text);
    font-weight: 500;
    text-align: right;
    user-select: all;
  }

  .val.mono {
    font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
  }

  .subsection {
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px dashed var(--theme-stroke);
  }

  .subsection h4 {
    margin: 0 0 8px 0;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .empty-state {
    padding: 24px;
    text-align: center;
    color: var(--theme-text-dim); /* Improved contrast for WCAG AAA */
    font-style: italic;
    font-size: var(--font-size-sm, 0.875rem); /* WCAG AAA: 14px minimum */
  }
</style>
