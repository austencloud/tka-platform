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
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .designation-item.whole {
    background: linear-gradient(
      135deg,
      rgba(99, 102, 241, 0.12) 0%,
      rgba(139, 92, 246, 0.08) 100%
    );
    border-color: rgba(99, 102, 241, 0.25);
  }

  .designation-item.section {
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.12) 0%,
      rgba(99, 102, 241, 0.08) 100%
    );
    border-color: rgba(59, 130, 246, 0.25);
  }

  .designation-item.steppair {
    background: linear-gradient(
      135deg,
      rgba(168, 85, 247, 0.12) 0%,
      rgba(139, 92, 246, 0.08) 100%
    );
    border-color: rgba(168, 85, 247, 0.25);
  }

  .designation-item.freeform {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.12) 0%,
      rgba(220, 38, 38, 0.08) 100%
    );
    border-color: rgba(239, 68, 68, 0.25);
  }

  .designation-item.modular {
    background: linear-gradient(
      135deg,
      rgba(234, 179, 8, 0.12) 0%,
      rgba(202, 138, 4, 0.08) 100%
    );
    border-color: rgba(234, 179, 8, 0.25);
  }

  .designation-item.axis-alternating {
    background: linear-gradient(
      135deg,
      rgba(20, 184, 166, 0.15) 0%,
      rgba(168, 85, 247, 0.12) 100%
    );
    border-color: rgba(20, 184, 166, 0.35);
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
    background: rgba(99, 102, 241, 0.3);
    color: #a5b4fc;
  }

  .section .designation-badge {
    background: rgba(59, 130, 246, 0.3);
    color: #93c5fd;
  }

  .steppair .designation-badge {
    background: rgba(168, 85, 247, 0.3);
    color: #c4b5fd;
  }

  .freeform .designation-badge {
    background: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .modular .designation-badge {
    background: rgba(234, 179, 8, 0.3);
    color: #fde047;
  }

  .axis-alternating .designation-badge {
    background: linear-gradient(
      135deg,
      rgba(20, 184, 166, 0.4) 0%,
      rgba(168, 85, 247, 0.4) 100%
    );
    color: #5eead4;
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
    background: rgba(239, 68, 68, 0.2);
    color: var(--semantic-error);
  }
</style>
