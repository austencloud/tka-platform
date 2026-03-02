<!--
  View Only Notice

  Displays verified badge with edit button for verified sequences.
-->
<script lang="ts">
  interface Props {
    onEdit: () => void;
  }

  let { onEdit }: Props = $props();
</script>

<div class="view-only-notice">
  <span class="verified-badge">Verified</span>
  <button class="edit-button" onclick={onEdit}> Edit Label </button>
</div>

<style>
  .view-only-notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md);
    background: var(--surface-dark, rgba(0, 0, 0, 0.3));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
  }

  .verified-badge {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: color-mix(in srgb, var(--semantic-success) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-success) 40%, transparent);
    border-radius: 8px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--semantic-success);
  }

  .edit-button {
    padding: var(--spacing-xs) var(--spacing-md);
    background: transparent;
    color: var(--muted-foreground);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 8px;
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .edit-button:hover {
    background: var(--theme-card-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--foreground);
  }
</style>
