<!--
SpellEmptyState.svelte - Minimal header for Spell tab

Just a simple title. No fluff.
-->
<script lang="ts">
  interface Props {
    onFocusInput?: () => void;
  }

  let { onFocusInput }: Props = $props();
</script>

<div class="empty-state" role="presentation">
  <h3 class="empty-title">Turn words into sequences</h3>
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px 20px 8px;
    text-align: center;
  }

  .empty-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
  }
</style>
