<script lang="ts">
  interface Props {
    count: number;
  }
  let { count }: Props = $props();
</script>

{#if count > 0}
  <span class="attendance-badge">
    <i class="fas fa-users" aria-hidden="true"></i>
    {count} going
  </span>
{/if}

<style>
  .attendance-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
  }
  .attendance-badge i {
    font-size: 10px;
  }
</style>
