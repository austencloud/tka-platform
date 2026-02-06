<!-- ArchiveLoadingState - Skeleton loading state for archive views -->
<script lang="ts">
  const { count = 3 } = $props<{
    count?: number;
  }>();
</script>

<div class="loading-state">
  {#each Array(count) as _, i (i)}
    <div class="skeleton-version"></div>
  {/each}
</div>

<style>
  .loading-state {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 800px;
    margin: 0 auto;
  }

  .skeleton-version {
    height: 72px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border-radius: 12px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-version {
      animation: none;
    }
  }
</style>
