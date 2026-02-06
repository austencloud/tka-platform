<!--
Type1PictographDisplay - Pictograph visualizer with loading state
-->
<script lang="ts">
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

  let {
    isLoading,
    pictographData,
  }: {
    isLoading: boolean;
    pictographData: PictographData | null;
  } = $props();
</script>

<div class="visualizer-container">
  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
    </div>
  {:else if pictographData}
    <PictographContainer
      {pictographData}
      showTKA={false}
      showReversals={false}
      disableTransitions={true}
    />
  {:else}
    <div class="error-state">
      <span class="error-icon">⚠</span>
      <span>Could not load pictograph</span>
    </div>
  {/if}
</div>

<style>
  .visualizer-container {
    width: 160px;
    height: 160px;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 12px var(--theme-shadow);
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    gap: 0.5rem;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(34, 211, 238, 0.2);
    border-top-color: #22d3ee;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-state {
    background: rgba(239, 68, 68, 0.05);
    color: var(--semantic-error);
  }

  .error-icon {
    font-size: 1.5rem;
  }

  @media (max-width: 500px) {
    .visualizer-container {
      width: 140px;
      height: 140px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
    }
  }
</style>
