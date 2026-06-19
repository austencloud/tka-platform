<script lang="ts">
  import { getStageChoreographyState } from '../state/stage-choreography-state.svelte';

  // The real 3D viewer will load a Blender-exported GLB stage (see
  // .claude/rules/blender-first-3d-scenes.md). Until that scene is authored,
  // this renders a placeholder. The loadState scaffold below is the seam the
  // GLB load will drive — flip to 'loading' while the asset streams in and
  // 'error' on failure so the canvas is never a silent blank.
  type ViewerLoadState = 'loading' | 'ready' | 'error';

  interface Props {
    /** Drives the load indicator once the GLB-backed scene is wired in. */
    loadState?: ViewerLoadState;
    /** Optional load progress 0..1 for the loading state. */
    progress?: number;
    /** Diagnostic shown in the error state. */
    errorMessage?: string;
  }

  // Default to 'ready' because the placeholder is synchronous today. When the
  // Blender GLB load is added, pass loadState/progress from the loader.
  let { loadState = 'ready', progress, errorMessage }: Props = $props();

  const stageState = getStageChoreographyState();
  const choreography = $derived(stageState.choreography);

  const progressPct = $derived(
    progress != null ? Math.round(Math.max(0, Math.min(1, progress)) * 100) : null
  );
</script>

<div class="stage-viewer" aria-label="3D stage preview">
  {#if loadState === 'loading'}
    <div class="placeholder-notice" role="status" aria-live="polite">
      <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
      <span>Loading stage{progressPct != null ? ` ${progressPct}%` : ''}</span>
      <span class="subtitle">Preparing 3D scene</span>
    </div>
  {:else if loadState === 'error'}
    <div class="placeholder-notice error" role="alert">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
      <span>Stage failed to load</span>
      <span class="subtitle">{errorMessage ?? 'Please try again'}</span>
    </div>
  {:else}
    <div class="placeholder-notice">
      <i class="fas fa-cube" aria-hidden="true"></i>
      <span>3D Preview</span>
      <span class="subtitle">{choreography.performers.length} performers</span>
    </div>
  {/if}
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

  .placeholder-notice.error {
    color: var(--semantic-error, #ef4444);
  }

  .placeholder-notice.error i {
    opacity: 0.85;
  }

  .subtitle {
    font-size: 0.8rem;
    opacity: 0.6;
  }
</style>
