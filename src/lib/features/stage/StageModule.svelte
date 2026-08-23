<script lang="ts">
  import { onDestroy } from "svelte";
  import { MediaQuery } from "svelte/reactivity";

  import EditHistoryShortcutBridge from "$lib/shared/keyboard/components/EditHistoryShortcutBridge.svelte";
  import PanelGroup from "$lib/shared/panels/PanelGroup.svelte";
  import type { PanelDefinition } from "$lib/shared/panels/PanelGroup.svelte";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { sceneEnvironmentIdForBackground } from "$lib/shared/3d/environments/domain/scene-environment";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";

  import FormationOverlay from "./components/FormationOverlay.svelte";
  import StageSidebar from "./components/StageSidebar.svelte";
  import StageTimeline from "./components/StageTimeline.svelte";
  import StageViewer from "./components/StageViewer.svelte";
  import { setStageChoreographyContext } from "./context/stage-choreography-context";
  import { createStageChoreographyState } from "./state/stage-choreography-state.svelte";
  import { createStageEditMode } from "./state/stage-edit-mode.svelte";
  import SceneStudio from "./scene/SceneStudio.svelte";

  const stageState = createStageChoreographyState({
    initialEnvironmentId: sceneEnvironmentIdForBackground(
      getSettings().backgroundType
    ),
  });
  setStageChoreographyContext(stageState);
  const editMode = createStageEditMode();
  const activeTab = $derived(navigationState.activeTab || "scene");
  const compactPortrait = new MediaQuery(
    "(max-width: 900px) and (orientation: portrait)"
  );
  let controlsOpen = $state(false);

  onDestroy(stageState.destroy);

  const workspacePanels: PanelDefinition[] = [
    { content: viewerPanel, defaultSize: 2.6, minSize: 200, id: "viewer" },
    {
      content: timelinePanel,
      defaultSize: 1.55,
      minSize: 170,
      maxSize: 540,
      id: "timeline",
    },
  ];

  function handleKeydown(event: KeyboardEvent): void {
    if (activeTab === "scene") return;
    const target = event.target as HTMLElement;
    const stageHasFocus =
      event.target === document.body || target.closest(".stage-module");
    if (!stageHasFocus) return;

    if (event.key === "t" || event.key === "T") {
      editMode.toggleCameraMode();
    } else if (event.key === "Escape" && controlsOpen) {
      controlsOpen = false;
    }
  }
</script>

{#snippet viewerPanel()}
  <div class="viewer-container">
    {#if editMode.cameraMode === "orbit"}
      <StageViewer />
    {:else}
      <div class="top-down-canvas">
        <FormationOverlay {editMode} />
      </div>
    {/if}

    <div class="stage-identity" aria-hidden="true">
      <strong>Stage</strong>
      <span>{stageState.choreography.performers.length} performers</span>
    </div>

    <div class="scene-rail" role="toolbar" aria-label="Stage workspace tools">
      <button
        type="button"
        class:active={editMode.cameraMode === "top-down"}
        onclick={() => editMode.toggleCameraMode()}
        aria-pressed={editMode.cameraMode === "top-down"}
        aria-label={editMode.cameraMode === "top-down"
          ? "Return to 3D view"
          : "Edit formations"}
        data-tooltip={editMode.cameraMode === "top-down"
          ? "3D view"
          : "Formation editor"}
      >
        <i
          class="fas {editMode.cameraMode === 'top-down'
            ? 'fa-cube'
            : 'fa-border-all'}"
          aria-hidden="true"
        ></i>
      </button>
      <button
        type="button"
        class:active={controlsOpen}
        onclick={() => (controlsOpen = !controlsOpen)}
        aria-pressed={controlsOpen}
        aria-label="Stage setup"
        data-tooltip="Stage setup"
      >
        <i class="fas fa-sliders" aria-hidden="true"></i>
      </button>
    </div>

    {#if controlsOpen}
      <aside class="stage-inspector" aria-label="Stage setup">
        <header>
          <div>
            <strong>Stage setup</strong>
            <span>Cast, formations, and environment</span>
          </div>
          <div class="inspector-actions">
            <button
              type="button"
              onclick={() => stageState.undo()}
              disabled={!stageState.canUndo}
              aria-label="Undo stage change"
            >
              <i class="fas fa-rotate-left" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              onclick={() => stageState.redo()}
              disabled={!stageState.canRedo}
              aria-label="Redo stage change"
            >
              <i class="fas fa-rotate-right" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              onclick={() => (controlsOpen = false)}
              aria-label="Close stage setup"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>
        </header>
        <div class="inspector-body">
          <StageSidebar {editMode} />
        </div>
      </aside>
    {/if}
  </div>
{/snippet}

{#snippet timelinePanel()}
  <StageTimeline {editMode} />
{/snippet}

<svelte:window onkeydown={handleKeydown} />

{#if activeTab === "scene"}
  <SceneStudio />
{:else}
  <div
    class="stage-module"
    role="main"
    aria-label="Stage performance editor"
    data-edit-history-shortcut-scope
  >
    <EditHistoryShortcutBridge
      onUndo={stageState.undo}
      onRedo={stageState.redo}
      canUndo={stageState.canUndo}
      canRedo={stageState.canRedo}
    />
    {#if compactPortrait.current}
      <div class="compact-stage-layout">
        <div class="compact-viewer">{@render viewerPanel()}</div>
        <div class="compact-timeline">{@render timelinePanel()}</div>
      </div>
    {:else}
      <PanelGroup direction="vertical" panels={workspacePanels} />
    {/if}
  </div>
{/if}

<style>
  .stage-module {
    display: flex;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--color-bg-primary, #080910);
  }

  .compact-stage-layout {
    display: grid;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    grid-template-rows: minmax(17rem, 54%) minmax(19rem, 1fr);
    overflow: hidden;
  }

  .compact-viewer,
  .compact-timeline {
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
  }

  .viewer-container {
    position: relative;
    min-width: 0;
    min-height: 0;
    flex: 1;
    overflow: hidden;
  }

  .viewer-container :global(.stage-viewer),
  .top-down-canvas {
    border-radius: 0;
  }

  .top-down-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--theme-panel-bg, #12121c);
  }

  .stage-identity {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 999px;
    background: rgba(12, 14, 22, 0.76);
    backdrop-filter: blur(18px) saturate(140%);
    color: var(--theme-text, white);
    pointer-events: none;
  }

  .stage-identity span {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .scene-rail {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .scene-rail button {
    position: relative;
    display: grid;
    width: 3.5rem;
    height: 3.5rem;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.875rem;
    background: rgba(20, 22, 32, 0.78);
    box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(20px) saturate(140%);
    color: rgba(255, 255, 255, 0.66);
    cursor: pointer;
    font-size: 1.25rem;
  }

  .scene-rail button.active {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 55%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 20%,
      rgba(20, 22, 32, 0.9)
    );
    color: white;
  }

  .scene-rail button:hover::after {
    position: absolute;
    top: 50%;
    right: calc(100% + 0.6rem);
    padding: 0.35rem 0.55rem;
    border-radius: 0.45rem;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    content: attr(data-tooltip);
    font-size: 0.7rem;
    font-weight: 700;
    white-space: nowrap;
    translate: 0 -50%;
  }

  .stage-inspector {
    position: absolute;
    top: 0.75rem;
    right: 5rem;
    bottom: 0.75rem;
    z-index: 25;
    display: flex;
    width: clamp(20rem, 30vw, 29rem);
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.13);
    border-radius: 1rem;
    background: rgba(10, 12, 19, 0.94);
    box-shadow: 0 0.75rem 3rem rgba(0, 0, 0, 0.58);
    backdrop-filter: blur(24px) saturate(130%);
  }

  .stage-inspector > header {
    display: flex;
    min-height: 4rem;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.55rem 0.65rem 0.55rem 0.9rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .stage-inspector > header > div:first-child {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.15rem;
  }

  .stage-inspector header strong {
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 0.875rem);
  }

  .stage-inspector header span {
    overflow: hidden;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    font-size: var(--font-size-compact, 0.75rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inspector-actions {
    display: flex;
    flex: 0 0 auto;
    gap: 0.25rem;
  }

  .inspector-actions button {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border: 1px solid transparent;
    border-radius: 0.65rem;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    cursor: pointer;
  }

  .inspector-actions button:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.07);
    color: white;
  }

  .inspector-actions button:disabled {
    opacity: 0.3;
  }

  .inspector-body {
    min-height: 0;
    flex: 1;
    overflow: hidden;
  }

  .inspector-body :global(.stage-sidebar) {
    height: 100%;
  }

  button:focus-visible {
    outline: 3px solid var(--theme-accent, #f59e0b);
    outline-offset: 3px;
  }

  @media (max-width: 700px) {
    .stage-identity span {
      display: none;
    }

    .stage-inspector {
      position: fixed;
      top: max(0.75rem, env(safe-area-inset-top));
      right: 0.75rem;
      bottom: calc(var(--primary-nav-height, 3.75rem) + 0.75rem);
      left: 0.75rem;
      z-index: 60;
      width: auto;
    }
  }

  @media (max-height: 600px) and (orientation: landscape) {
    .stage-inspector {
      position: fixed;
      top: 0.75rem;
      right: 0.75rem;
      bottom: 0.75rem;
      left: auto;
      z-index: 60;
      width: min(29rem, calc(100vw - 6rem));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scene-rail button,
    .inspector-actions button {
      transition: none;
    }
  }
</style>
