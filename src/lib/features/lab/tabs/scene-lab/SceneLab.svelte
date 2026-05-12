<script lang="ts">
  /**
   * SceneLab
   *
   * A visual-tuning harness for 3D environment scenes. Select a scene, drive
   * every knob via sliders and color pickers, and copy the resulting config
   * back into scene-configs.ts as the new baked default.
   */

  import { SCENE_OPTIONS } from "./domain/scene-lab-types";
  import type { SceneId } from "./domain/scene-lab-types";
  import { createSceneLabState } from "./state/scene-lab-state.svelte";
  import { setSceneLabContext } from "./context/scene-lab-context";
  import ScenePreview from "./components/ScenePreview.svelte";
  import WinterControls from "./components/WinterControls.svelte";
  import ForestControls from "./components/ForestControls.svelte";
  import CosmicControls from "./components/CosmicControls.svelte";

  const sceneState = createSceneLabState();
  setSceneLabContext({ state: sceneState });

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
    <p class="subtitle">
      Tune 3D environment scenes with live sliders. Copy the config back into
      <code>scene-configs.ts</code> once it looks right.
    </p>
  </header>

  <div class="layout">
    <div class="preview-pane">
      <ScenePreview />
    </div>

    <aside class="controls-pane">
      <div class="scene-picker">
        <label class="picker-label" for="scene-select">Scene</label>
        <select
          id="scene-select"
          class="scene-select"
          value={sceneState.sceneId}
          onchange={(e) =>
            sceneState.setSceneId(e.currentTarget.value as SceneId)}
        >
          {#each SCENE_OPTIONS as option}
            <option value={option.id}>{option.label}</option>
          {/each}
        </select>
      </div>

      <div class="actions">
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
      </div>

      <div class="controls-scroll">
        {#if sceneState.sceneId === "winter"}
          <WinterControls />
        {:else if sceneState.sceneId === "cosmic-night"}
          <CosmicControls variant="night" />
        {:else if sceneState.sceneId === "cosmic-aurora"}
          <CosmicControls variant="aurora" />
        {:else}
          <ForestControls />
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
  }

  .header h1 {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--theme-text, white);
    margin: 0 0 2px;
  }

  .subtitle {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    margin: 0;
  }

  .subtitle code {
    font-family: ui-monospace, "SF Mono", monospace;
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 6px;
    border-radius: 4px;
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

  .scene-picker {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
  }

  .picker-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .scene-select {
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
  }

  .scene-select:focus {
    outline: none;
    border-color: var(--theme-accent, #38bdf8);
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
