<!--
  LOOP Labeler Empty State

  Shown when no sequences match current filters.
-->
<script lang="ts">
  interface Props {
    onShowAll: () => void;
  }

  let { onShowAll }: Props = $props();
</script>

<div class="empty-state">
  <p>No sequences to label with current filters.</p>
  <button onclick={onShowAll}> Show All Sequences </button>
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-lg);
    height: 100vh;
    font-size: var(--font-size-lg);
    color: var(--muted);
  }

  .empty-state button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--gradient-primary);
    color: var(--foreground);
    border: none;
    border-radius: 8px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
  }

  .empty-state button:hover {
    transform: translateY(var(--hover-lift-sm));
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  }
</style>
