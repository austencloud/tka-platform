<!--
  CellInspector.svelte

  Panel showing selected cell properties and allowing edits.
-->
<script lang="ts">
  import type { ConstraintCell, CellMediaType } from "../domain/types";
  import { MEDIA_COLORS } from "../services/layout-presets";

  let {
    cell,
    onUpdateLabel,
    onUpdateZIndex,
    onUpdateColor,
    onUpdateMediaType,
    onDeleteCell,
    onDuplicateCell,
  }: {
    cell: ConstraintCell;
    onUpdateLabel: (label: string) => void;
    onUpdateZIndex: (zIndex: number) => void;
    onUpdateColor: (color: string) => void;
    onUpdateMediaType: (mediaType: CellMediaType) => void;
    onDeleteCell: () => void;
    onDuplicateCell: () => void;
  } = $props();

  const MEDIA_TYPES: { type: CellMediaType; label: string; icon: string }[] = [
    { type: "video", label: "Video", icon: "video" },
    { type: "animation", label: "Animation", icon: "play-circle" },
    { type: "image", label: "Image", icon: "image" },
    { type: "choreo-card", label: "Choreo Card", icon: "th" },
    { type: "viewer-3d", label: "3D Viewer", icon: "cube" },
  ];

  const COLORS = [
    "#8b5cf6", // Purple
    "#3b82f6", // Blue
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#84cc16", // Lime
  ];

  function handleLabelChange(e: Event) {
    const input = e.target as HTMLInputElement;
    onUpdateLabel(input.value);
  }

  function handleZIndexChange(e: Event) {
    const input = e.target as HTMLInputElement;
    onUpdateZIndex(parseInt(input.value, 10) || 1);
  }

  function handleMediaTypeChange(mediaType: CellMediaType) {
    onUpdateMediaType(mediaType);
    // Also update color to match media type
    onUpdateColor(MEDIA_COLORS[mediaType]);
    // Update label to match media type
    const mediaInfo = MEDIA_TYPES.find((m) => m.type === mediaType);
    if (mediaInfo) {
      onUpdateLabel(mediaInfo.label);
    }
  }
</script>

<div class="cell-inspector">
  <h3 class="section-title">Selected Cell</h3>

  <!-- Media Type -->
  <div class="field">
    <div class="field-label" id="media-type-label">Media Type</div>
    <div class="media-type-grid" role="group" aria-labelledby="media-type-label">
      {#each MEDIA_TYPES as media}
        <button
          class="media-type-btn"
          class:selected={cell.mediaType === media.type}
          onclick={() => handleMediaTypeChange(media.type)}
          title={media.label}
          aria-label="Set media type to {media.label}"
        >
          <i class="fas fa-{media.icon}" aria-hidden="true"></i>
        </button>
      {/each}
    </div>
  </div>

  <!-- Label -->
  <div class="field">
    <label for="cell-label">Label</label>
    <input
      id="cell-label"
      type="text"
      value={cell.label}
      oninput={handleLabelChange}
    />
  </div>

  <!-- Z-Index -->
  <div class="field">
    <label for="cell-z">Z-Index (layer order)</label>
    <input
      id="cell-z"
      type="number"
      min="1"
      max="100"
      value={cell.zIndex}
      oninput={handleZIndexChange}
    />
  </div>

  <!-- Color -->
  <div class="field">
    <div class="field-label" id="color-label">Color</div>
    <div class="color-grid" role="group" aria-labelledby="color-label">
      {#each COLORS as color}
        <button
          class="color-btn"
          class:selected={cell.color === color}
          style:background={color}
          onclick={() => onUpdateColor(color)}
          aria-label="Set color to {color}"
        ></button>
      {/each}
    </div>
  </div>

  <!-- Position info (read-only) -->
  <div class="info-row">
    <div class="info-item">
      <span class="info-label">X</span>
      <span class="info-value">{Math.round(cell.computed.x)}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Y</span>
      <span class="info-value">{Math.round(cell.computed.y)}</span>
    </div>
    <div class="info-item">
      <span class="info-label">W</span>
      <span class="info-value">{Math.round(cell.computed.width)}</span>
    </div>
    <div class="info-item">
      <span class="info-label">H</span>
      <span class="info-value">{Math.round(cell.computed.height)}</span>
    </div>
  </div>

  <!-- Actions -->
  <div class="actions">
    <button class="action-btn" onclick={onDuplicateCell}>
      <i class="fas fa-clone" aria-hidden="true"></i>
      Duplicate
    </button>
    <button class="action-btn danger" onclick={onDeleteCell}>
      <i class="fas fa-trash" aria-hidden="true"></i>
      Delete
    </button>
  </div>
</div>

<style>
  .cell-inspector {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 12px);
  }

  .section-title {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs, 4px);
  }

  .field .field-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .field input {
    padding: var(--spacing-sm, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-sm, 4px);
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
  }

  .field input:focus {
    outline: none;
    border-color: var(--theme-accent, #8b5cf6);
  }

  .media-type-grid {
    display: flex;
    gap: var(--spacing-xs, 4px);
  }

  .media-type-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-sm, 8px);
    min-height: 40px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-sm, 4px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 1rem;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .media-type-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
  }

  .media-type-btn.selected {
    background: var(--theme-accent, #8b5cf6);
    border-color: var(--theme-accent, #8b5cf6);
    color: white;
  }

  .color-grid {
    display: flex;
    gap: var(--spacing-xs, 4px);
    flex-wrap: wrap;
  }

  .color-btn {
    width: 28px;
    height: 28px;
    border: 2px solid transparent;
    border-radius: var(--border-radius-sm, 4px);
    cursor: pointer;
    transition: transform 0.1s ease, border-color 0.1s ease;
  }

  .color-btn:hover {
    transform: scale(1.1);
  }

  .color-btn.selected {
    border-color: white;
    box-shadow: 0 0 0 2px var(--theme-panel-bg, #12121c);
  }

  .info-row {
    display: flex;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--border-radius-sm, 4px);
  }

  .info-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
  }

  .info-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .info-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text, white);
  }

  .actions {
    display: flex;
    gap: var(--spacing-sm, 8px);
    margin-top: var(--spacing-sm, 8px);
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px);
    min-height: 40px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-sm, 4px);
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .action-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .action-btn.danger {
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    color: var(--semantic-error, #ef4444);
  }

  .action-btn.danger:hover {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 50%, transparent);
  }
</style>
