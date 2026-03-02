<script lang="ts">
  /**
   * Designation Item
   *
   * Renders a single designation with type badge and optional remove button.
   */
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";

  type DesignationType =
    | "whole"
    | "section"
    | "steppair"
    | "freeform"
    | "modular"
    | "axis-alternating";

  interface Props {
    type: DesignationType;
    label: string;
    badge: string;
    onRemove?: () => void;
  }

  let { type, label, badge, onRemove }: Props = $props();
</script>

<div class="designation-item {type}">
  <span class="designation-badge">{badge}</span>
  <span class="designation-label">{label}</span>
  {#if onRemove}
    <button class="remove-btn" onclick={onRemove} aria-label="Remove {label} designation">
      <FontAwesomeIcon icon="xmark" size="0.85em" />
    </button>
  {/if}
</div>

<style>
  .designation-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: 8px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
  }

  .designation-item.whole {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--primary-color) 12%, transparent) 0%,
      color-mix(in srgb, var(--feature-edit) 8%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--primary-color) 25%, transparent);
  }

  .designation-item.section {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-info) 12%, transparent) 0%,
      color-mix(in srgb, var(--primary-color) 8%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--semantic-info) 25%, transparent);
  }

  .designation-item.steppair {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--feature-edit) 12%, transparent) 0%,
      color-mix(in srgb, var(--feature-edit) 8%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--feature-edit) 25%, transparent);
  }

  .designation-item.freeform {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-error) 12%, transparent) 0%,
      color-mix(in srgb, var(--semantic-error) 8%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--semantic-error) 25%, transparent);
  }

  .designation-item.modular {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-warning) 12%, transparent) 0%,
      color-mix(in srgb, var(--semantic-warning) 8%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--semantic-warning) 25%, transparent);
  }

  .designation-item.axis-alternating {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent-teal) 15%, transparent) 0%,
      color-mix(in srgb, var(--feature-edit) 12%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--accent-teal) 35%, transparent);
  }

  .designation-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    font-size: var(--font-size-compact);
    font-weight: 700;
    flex-shrink: 0;
  }

  .whole .designation-badge {
    background: color-mix(in srgb, var(--primary-color) 30%, transparent);
    color: color-mix(in srgb, var(--primary-color) 65%, white);
  }

  .section .designation-badge {
    background: color-mix(in srgb, var(--semantic-info) 30%, transparent);
    color: var(--semantic-info-text);
  }

  .steppair .designation-badge {
    background: color-mix(in srgb, var(--feature-edit) 30%, transparent);
    color: color-mix(in srgb, var(--feature-edit) 65%, white);
  }

  .freeform .designation-badge {
    background: color-mix(in srgb, var(--semantic-error) 30%, transparent);
    color: color-mix(in srgb, var(--semantic-error) 65%, white);
  }

  .modular .designation-badge {
    background: color-mix(in srgb, var(--semantic-warning) 30%, transparent);
    color: var(--semantic-warning-text-vivid);
  }

  .axis-alternating .designation-badge {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent-teal) 40%, transparent) 0%,
      color-mix(in srgb, var(--feature-edit) 40%, transparent) 100%
    );
    color: color-mix(in srgb, var(--accent-teal) 65%, white);
  }

  .designation-label {
    flex: 1;
    font-size: var(--font-size-sm);
    font-weight: 500;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--muted-foreground);
    cursor: pointer;
    transition: var(--transition-micro);
    flex-shrink: 0;
  }

  .remove-btn:hover {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    color: var(--semantic-error);
  }
</style>
