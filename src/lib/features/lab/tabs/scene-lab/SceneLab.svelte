<script lang="ts">
  /**
   * SceneLab
   *
   * A visual-tuning harness for 3D environment scenes. Select a scene, drive
   * every knob via sliders and color pickers, and copy the resulting config
   * back into scene-configs.ts as the new baked default.
   */

  import { SCENE_OPTIONS } from "./domain/scene-lab-types";
  import { createSceneLabState } from "./state/scene-lab-state.svelte";
  import { setSceneLabContext } from "./context/scene-lab-context";
  import ScenePreview from "./components/ScenePreview.svelte";
  import WinterControls from "./components/WinterControls.svelte";
  import ForestControls from "./components/ForestControls.svelte";
  import CosmicControls from "./components/CosmicControls.svelte";
  import OceanControls from "./components/OceanControls.svelte";
  import ComposerPickerPanel from "$lib/shared/3d/scene-composer/ComposerPickerPanel.svelte";
  import { createComposerEditorState } from "$lib/shared/3d/scene-composer/composer-editor-state.svelte";
  import { composerRegistry } from "$lib/shared/3d/scene-composer/registry";
  import { FilePersistence } from "$lib/shared/3d/scene-composer/persistence/file-persistence";
  import "$lib/shared/3d/environments/scenes/autumn/autumn-composer-plugin";

  const sceneState = createSceneLabState();
  const composerState = createComposerEditorState();
  setSceneLabContext({ state: sceneState, composerState });

  const persistence = new FilePersistence();

  let copyStatus = $state<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      await sceneState.copyCurrentToClipboard();
      copyStatus = "copied";
      setTimeout(() => (copyStatus = "idle"), 1500);
    } catch {
      copyStatus = "error";
      setTimeout(() => (copyStatus = "idle"), 2000);
    }
  }

  function handleReset() {
    if (confirm("Reset this scene's config to defaults?")) {
      sceneState.resetCurrent();
    }
  }
</script>

<div class="scene-lab">
  <header class="header">
    <h1>Scene Lab</h1>
    <div class="scene-strip">
      {#each SCENE_OPTIONS as option}
        <button
          class:active={sceneState.sceneId === option.id}
          onclick={() => sceneState.setSceneId(option.id)}
          title={option.description}
        >
          {option.label}
        </button>
      {/each}
    </div>
  </header>

  <div class="layout">
    <div class="preview-pane">
      <ScenePreview />
    </div>

    <aside class="controls-pane">
      <div class="actions">
        {#if composerState.active}
          <button class="action-btn" onclick={() => composerState.setActive(false)}>
            <i class="fas fa-arrow-left"></i> Controls
          </button>
          <button
            class="action-btn primary"
            onclick={async () => {
              const plugin = composerRegistry.get(sceneState.sceneId);
              if (plugin) {
                await persistence.save(plugin.sceneId, composerState.placements);
                composerState.markClean();
              }
            }}
          >
            <i class="fas fa-save"></i> Save
            {#if composerState.dirty}<span class="dirty-dot"></span>{/if}
          </button>
        {:else}
          <button class="action-btn" onclick={handleReset} title="Reset to defaults">
            <i class="fas fa-undo"></i> Reset
          </button>
          <button
            class="action-btn primary"
            class:success={copyStatus === "copied"}
            class:error={copyStatus === "error"}
            onclick={handleCopy}
            title="Copy TypeScript config to clipboard"
          >
            {#if copyStatus === "copied"}
              <i class="fas fa-check"></i> Copied
            {:else if copyStatus === "error"}
              <i class="fas fa-xmark"></i> Failed
            {:else}
              <i class="fas fa-copy"></i> Copy config
            {/if}
          </button>
        {/if}
      </div>

      <div class="controls-scroll">
        {#if composerState.active}
          {@const plugin = composerRegistry.get(sceneState.sceneId)}
          {#if plugin}
            <ComposerPickerPanel
              catalog={plugin.catalog}
              sceneName={plugin.displayName}
              placedCount={composerState.placements.length}
              activeItemKey={composerState.activeCatalogItem?.key ?? null}
              onSelectItem={(def) => composerState.startPlacement(def)}
              onDeselectItem={() => composerState.stopPlacement()}
              onClose={() => composerState.setActive(false)}
            />
          {/if}
        {:else if sceneState.sceneId === "winter"}
          <WinterControls />
        {:else if sceneState.sceneId === "forest"}
          <ForestControls />
        {:else if sceneState.sceneId === "cosmic"}
          <CosmicControls />
        {:else if sceneState.sceneId === "ocean"}
          <OceanControls />
        {/if}
      </div>
    </aside>
  </div>
</div>

<style>
  .scene-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px 20px 20px;
    overflow: hidden;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }

  .header {
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header h1 {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--theme-text, white);
    margin: 0;
    white-space: nowrap;
  }

  .scene-strip {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: rgba(10, 14, 26, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .scene-strip::-webkit-scrollbar {
    display: none;
  }

  .scene-strip button {
    display: flex;
    align-items: center;
    padding: 7px 14px;
    background: transparent;
    border: none;
    border-radius: 9px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: all 180ms cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
    position: relative;
  }

  .scene-strip button:hover {
    color: rgba(255, 255, 255, 0.92);
    background: rgba(255, 255, 255, 0.06);
  }

  .scene-strip button:active {
    transform: scale(0.97);
    transition: transform 80ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .scene-strip button.active {
    background: color-mix(in srgb, var(--theme-accent, #38bdf8) 22%, transparent);
    color: var(--theme-accent-text, #7dd3fc);
    box-shadow:
      0 0 12px color-mix(in srgb, var(--theme-accent, #38bdf8) 18%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .scene-strip button:focus-visible {
    outline: 2px solid var(--theme-accent, #38bdf8);
    outline-offset: 2px;
  }

  .layout {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 16px;
    flex: 1;
    min-height: 0;
  }

  .preview-pane {
    position: relative;
    min-height: 0;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .controls-pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 12px;
    padding: 14px;
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .action-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .action-btn.primary {
    background: color-mix(in srgb, var(--theme-accent, #38bdf8) 18%, transparent);
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #38bdf8) 35%,
      transparent
    );
    color: var(--theme-accent, #38bdf8);
  }

  .action-btn.primary:hover {
    background: color-mix(in srgb, var(--theme-accent, #38bdf8) 28%, transparent);
  }

  .action-btn.success {
    background: color-mix(in srgb, #10b981 22%, transparent);
    border-color: color-mix(in srgb, #10b981 40%, transparent);
    color: #34d399;
  }

  .action-btn.error {
    background: color-mix(in srgb, #ef4444 22%, transparent);
    border-color: color-mix(in srgb, #ef4444 40%, transparent);
    color: #f87171;
  }

  .controls-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
  }

  .dirty-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f59e0b;
    margin-left: 4px;
  }

  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(300px, 1fr) auto;
    }

    .controls-pane {
      max-height: 50vh;
    }
  }
</style>
