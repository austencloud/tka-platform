<script lang="ts">
  /**
   * CompositionCell - Individual cell in the composition grid
   *
   * Displays either:
   * - Empty state (prompt to add sequence)
   * - Placeholder with sequence info (static mode)
   * - Live animation preview (preview mode)
   * - Full playback (playing mode)
   */

  import type { CellConfig } from "$lib/shared/animation-engine/domain/compose-types";
  import { isCellConfigured } from "$lib/shared/animation-engine/domain/compose-types";
  import CellOverlay from "./CellOverlay.svelte";
  import CellRenderer from "./CellRenderer.svelte";
  import { getCompositionState } from "../../state/composition-state.svelte";

  interface Props {
    cell: CellConfig;
    isPlaying: boolean;
    isPreviewing: boolean;
    isSelected: boolean;
    onClick: () => void;
  }

  let { cell, isPlaying, isPreviewing, isSelected, onClick }: Props = $props();

  const compState = getCompositionState();
  const bpm = $derived(compState.bpm);
  const currentStep = $derived(compState.currentStep);

  const isConfigured = $derived(isCellConfigured(cell));
  // Always render animation for configured cells - shows first frame when paused
  const shouldRenderAnimation = $derived(isConfigured);
  const sequenceCount = $derived(cell.sequences.length);
  const primarySequence = $derived(cell.sequences[0] ?? null);

  // Cell type indicator
  const typeLabel = $derived(cell.type === "tunnel" ? "Tunnel" : "Single");
  const typeIcon = $derived(
    cell.type === "tunnel" ? "fa-layer-group" : "fa-square"
  );

  // Rotation indicator
  const hasRotation = $derived((cell.rotationOffset ?? 0) !== 0);
  const rotationLabel = $derived(`${cell.rotationOffset ?? 0}°`);
</script>

<button
  class="composition-cell"
  class:configured={isConfigured}
  class:selected={isSelected}
  class:playing={isPlaying}
  class:tunnel={cell.type === "tunnel"}
  onclick={onClick}
  role="gridcell"
  aria-label={isConfigured
    ? `Cell with ${primarySequence?.name || "sequence"}, ${typeLabel} mode`
    : "Empty cell, click to configure"}
  aria-selected={isSelected}
>
  {#if isConfigured}
    <!-- Configured cell content -->
    <div class="cell-content">
      {#if shouldRenderAnimation}
        <!-- Live animation rendering -->
        <CellRenderer {cell} {isPlaying} {isPreviewing} {bpm} {currentStep} />
      {:else}
        <!-- Static preview -->
        <div class="static-preview">
          <div class="sequence-info">
            <span class="sequence-name"
              >{primarySequence?.name || "Sequence"}</span
            >
            {#if cell.type === "tunnel" && sequenceCount > 1}
              <span class="sequence-count">+{sequenceCount - 1} more</span>
            {/if}
          </div>

          <!-- Cell type badge -->
          <div class="type-badge">
            <i class="fas {typeIcon}" aria-hidden="true"></i>
            <span>{typeLabel}</span>
          </div>

          <!-- Rotation badge (if rotated) -->
          {#if hasRotation}
            <div class="rotation-badge">
              <i class="fas fa-sync-alt" aria-hidden="true"></i>
              <span>{rotationLabel}</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Hover overlay with actions -->
    <CellOverlay {cell} {isSelected} />
  {:else}
    <!-- Empty cell -->
    <div class="empty-state">
      <div class="empty-icon">
        <i class="fas fa-plus" aria-hidden="true"></i>
      </div>
      <span class="empty-label">Add Sequence</span>
    </div>
  {/if}

  <!-- Selection indicator -->
  {#if isSelected}
    <div class="selection-ring"></div>
  {/if}
</button>

<style>
  /* CompositionCell - 1:1 aspect ratio, no gaps, no rounded edges */
  .composition-cell {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1 / 1;
    background: var(--theme-card-bg);
    /* Thin border for subtle separation, shared between cells */
    border: 1px solid var(--theme-stroke);
    border-radius: 0;
    cursor: pointer;
    transition:
      background 0.2s ease,
      border-color 0.2s ease;
    overflow: hidden;
    padding: 0;
    color: var(--theme-text, white);
    text-align: center;
    container-type: size;
    container-name: cell;
  }

  .composition-cell:hover {
    border-color: var(--theme-stroke-strong);
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
  }

  .composition-cell:focus {
    outline: none;
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 60%,
      transparent
    );
  }

  .composition-cell.selected {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 80%,
      transparent
    );
  }

  .composition-cell.configured {
    background: var(--theme-card-bg);
  }

  .composition-cell.tunnel {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 10%,
      var(--theme-card-bg)
    );
  }

  .composition-cell.playing {
    border-color: rgba(16, 185, 129, 0.4);
  }

  /* Cell content */
  .cell-content {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: clamp(4px, 3cqi, 16px);
  }

  /* Static preview */
  .static-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(2px, 2cqi, 8px);
    width: 100%;
  }

  .sequence-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(1px, 0.5cqi, 4px);
  }

  .sequence-name {
    font-size: clamp(0.65rem, 4cqi, 1rem);
    font-weight: 600;
    color: var(--theme-text, var(--theme-text));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .sequence-count {
    font-size: clamp(0.55rem, 3cqi, 0.8rem);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .type-badge,
  .rotation-badge {
    display: flex;
    align-items: center;
    gap: clamp(2px, 1cqi, 6px);
    padding: clamp(1px, 0.5cqi, 4px) clamp(4px, 2cqi, 10px);
    background: var(--theme-card-bg);
    border-radius: clamp(2px, 1cqi, 6px);
    font-size: clamp(0.55rem, 3cqi, 0.75rem);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .type-badge i,
  .rotation-badge i {
    font-size: 0.8em;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(2px, 2cqi, 8px);
    color: var(--theme-text-dim);
    transition: color var(--duration-normal) ease;
  }

  .composition-cell:hover .empty-state {
    color: var(--theme-text);
  }

  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(24px, 20cqi, var(--min-touch-target));
    height: clamp(24px, 20cqi, var(--min-touch-target));
    border: clamp(1px, 0.5cqi, 3px) dashed currentColor;
    border-radius: 50%;
    font-size: clamp(0.75rem, 8cqi, 1.5rem);
  }

  .empty-label {
    font-size: clamp(0.65rem, 4cqi, 0.9rem);
    font-weight: 500;
  }

  /* Selection ring */
  .selection-ring {
    position: absolute;
    inset: -2px;
    border: 2px solid
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 80%,
        transparent
      );
    border-radius: 0;
    pointer-events: none;
    animation: pulse-ring 1.5s ease-in-out infinite;
  }

  @keyframes pulse-ring {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .composition-cell {
      transition: none;
    }

    .selection-ring {
      animation: none;
    }
  }
</style>
