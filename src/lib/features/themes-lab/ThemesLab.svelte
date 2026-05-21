<script lang="ts">
  import { onMount } from "svelte";
  import { setSceneLabContext } from "$lib/features/lab/tabs/scene-lab/context/scene-lab-context";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";
  import { createThemesLabState } from "./state/themes-lab-state.svelte";
  import ThemeStrip from "./components/ThemeStrip.svelte";
  import ThemeHeader from "./components/ThemeHeader.svelte";
  import ThemeControlsPanel from "./components/ThemeControlsPanel.svelte";
  import ScenePreview from "$lib/features/lab/tabs/scene-lab/components/ScenePreview.svelte";
  import type { ThemeId } from "./domain/theme-types";

  import DeepOceanLab from "$lib/features/background-builder/components/DeepOceanLab.svelte";
  import NightSkyLab from "$lib/features/background-builder/components/NightSkyLab.svelte";
  import FireflyForestLab from "$lib/features/background-builder/components/FireflyForestLab.svelte";
  import CherryBlossomLab from "$lib/features/background-builder/components/CherryBlossomLab.svelte";
  import PrideLab from "$lib/features/background-builder/components/PrideLab.svelte";
  import EmberGlowLab from "$lib/features/background-builder/components/EmberGlowLab.svelte";
  import SnowfallLab from "$lib/features/background-builder/components/SnowfallLab.svelte";
  import AutumnDriftLab from "$lib/features/background-builder/components/AutumnDriftLab.svelte";

  const state = createThemesLabState();

  setSceneLabContext(state.sceneLabContext);

  const labComponents: Record<string, any> = {
    ocean: DeepOceanLab,
    cosmic: NightSkyLab,
    forest: FireflyForestLab,
    blossom: CherryBlossomLab,
    pride: PrideLab,
    ember: EmberGlowLab,
    winter: SnowfallLab,
    autumn: AutumnDriftLab,
  };

  const CurrentLabComponent = $derived(labComponents[state.themeId] ?? null);

  function handleThemeSelect(id: ThemeId) {
    state.setTheme(id);
    const option = state.currentTheme;
    if (option) {
      applyThemeForBackground(option.backgroundType);
    }
  }

  onMount(() => {
    const option = state.currentTheme;
    if (option) {
      applyThemeForBackground(option.backgroundType);
    }
  });
</script>

<div class="themes-lab">
  <ThemeStrip
    themes={state.themeOptions}
    activeId={state.themeId}
    onSelect={handleThemeSelect}
  />

  <ThemeHeader
    label={state.currentTheme?.label ?? ""}
    color={state.currentTheme?.color ?? "#888"}
    mode={state.mode}
    onModeChange={(m) => state.setMode(m)}
  />

  <div class="content" class:mode-3d={state.mode === "3d"}>
    {#if state.mode === "2d"}
      {#if CurrentLabComponent}
        <CurrentLabComponent />
      {:else}
        <div class="placeholder">
          <i class="fas fa-paint-brush"></i>
          <p>2D background coming soon for {state.currentTheme?.label ?? "this theme"}</p>
        </div>
      {/if}
    {:else}
      <div class="preview-pane">
        <ScenePreview />
      </div>
      <aside class="controls-pane">
        <ThemeControlsPanel
          themeId={state.themeId}
          sceneState={state.sceneState}
        />
      </aside>
    {/if}
  </div>
</div>

<style>
  .themes-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px 20px 20px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    gap: 8px;
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .content.mode-3d {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 16px;
    overflow: hidden;
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

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.35);
  }

  .placeholder i {
    font-size: 3rem;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .placeholder p {
    font-size: 0.875rem;
  }

  @media (max-width: 900px) {
    .content.mode-3d {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(300px, 1fr) auto;
    }

    .controls-pane {
      max-height: 50vh;
    }
  }
</style>
