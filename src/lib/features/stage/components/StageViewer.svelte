<script lang="ts">
  import { getStageChoreographyState } from '../state/stage-choreography-state.svelte';

  const stageState = getStageChoreographyState();
  const interpolatedPositions = $derived(stageState.interpolatedPositions);
  const choreography = $derived(stageState.choreography);
</script>

<div class="stage-viewer" aria-label="3D stage preview">
  <div class="placeholder-notice">
    <i class="fas fa-cube" aria-hidden="true"></i>
    <span>3D Preview</span>
    <span class="subtitle">{choreography.performers.length} performers</span>
  </div>
</div>

<style>
  .stage-viewer {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: var(--border-radius-lg, 12px);
    position: relative;
  }

  .placeholder-notice {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: 1rem;
  }

  .placeholder-notice i {
    font-size: 2rem;
    opacity: 0.5;
  }

  .subtitle {
    font-size: 0.8rem;
    opacity: 0.6;
  }
</style>
