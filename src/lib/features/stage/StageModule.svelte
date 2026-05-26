<script lang="ts">
  import StageViewer from './components/StageViewer.svelte';
  import FormationOverlay from './components/FormationOverlay.svelte';
  import StageTimeline from './components/StageTimeline.svelte';
  import StageSidebar from './components/StageSidebar.svelte';
  import { getStageChoreographyState } from './state/stage-choreography-state.svelte';
  import { createStageEditMode } from './state/stage-edit-mode.svelte';

  const stageState = getStageChoreographyState();
  const editMode = createStageEditMode();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 't' || e.key === 'T') {
      if (e.target === document.body || (e.target as HTMLElement)?.closest('.stage-module')) {
        editMode.toggleCameraMode();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="stage-module" role="main" aria-label="Stage choreography editor">
  <div class="canvas-area">
    <div class="viewer-container">
      {#if editMode.cameraMode === 'orbit'}
        <StageViewer />
      {:else}
        <div class="top-down-canvas">
          <FormationOverlay {editMode} />
        </div>
      {/if}
    </div>

    <div class="mode-toolbar">
      <button
        type="button"
        class="mode-toggle"
        class:active={editMode.cameraMode === 'top-down'}
        onclick={() => editMode.toggleCameraMode()}
        aria-pressed={editMode.cameraMode === 'top-down'}
        aria-label="Toggle formation edit mode (T)"
        title="Toggle formation edit mode (T)"
      >
        <i class="fas {editMode.cameraMode === 'top-down' ? 'fa-cube' : 'fa-border-all'}" aria-hidden="true"></i>
        <span>{editMode.cameraMode === 'top-down' ? '3D View' : 'Edit'}</span>
      </button>
    </div>

    <StageTimeline {editMode} />
  </div>

  <StageSidebar {editMode} />
</div>

<style>
  .stage-module {
    display: grid;
    grid-template-columns: 1fr clamp(340px, 25vw, 480px);
    height: 100%;
    overflow: hidden;
    background: var(--color-bg-primary, #0a0b10);
  }

  .canvas-area {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .viewer-container {
    flex: 1;
    position: relative;
    min-height: 0;
  }

  .top-down-canvas {
    width: 100%;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
    position: relative;
  }

  .mode-toolbar {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 10;
  }

  .mode-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 48px;
    padding: 8px 16px;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 150ms ease;
  }

  .mode-toggle.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
    color: white;
  }

  .mode-toggle:hover:not(.active) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-toggle {
      transition: none;
    }
  }
</style>
